import { useState } from 'react';
import { toast } from 'sonner';
import { importLinkedInProfile } from '../services/connectionService';
import { normalizeLinkedInProfileUrl, profileTextFromLinkedInData } from '../lib/linkedinUrl';

export type LinkedInImportPreview = {
  linkedinUrl: string;
  resumeText: string;
  displayName?: string;
  headline?: string;
  photoUrl?: string;
};

export function useLinkedInImporter(
  updateProfile: (data: any) => Promise<void>,
  profile: any,
  processResumeText: (
    text: string,
    options?: { onSuccess?: () => void; quiet?: boolean; hyperlinkUrls?: string[] }
  ) => Promise<boolean>
) {
  const [importing, setImporting] = useState(false);
  const [linkedinInput, setLinkedinInput] = useState(
    profile?.structuredProfile?.contact?.linkedin || ''
  );
  const [preview, setPreview] = useState<LinkedInImportPreview | null>(null);

  const loadLinkedInPreview = async (rawUrl: string): Promise<LinkedInImportPreview | null> => {
    const normalized = normalizeLinkedInProfileUrl(rawUrl);
    if (!normalized) {
      toast.error('Enter a valid LinkedIn profile URL (linkedin.com/in/username)');
      return null;
    }

    setImporting(true);
    try {
      const { profile: linkedInData, linkedinUrl } = await importLinkedInProfile(normalized);
      const resumeFromLinkedIn = profileTextFromLinkedInData(linkedInData);

      if (!resumeFromLinkedIn || resumeFromLinkedIn.length < 20) {
        toast.error('Could not extract enough profile data from LinkedIn.');
        return null;
      }

      const next: LinkedInImportPreview = {
        linkedinUrl,
        resumeText: resumeFromLinkedIn,
        displayName:
          (typeof linkedInData.name === 'string' && linkedInData.name) ||
          (typeof linkedInData.fullName === 'string' && linkedInData.fullName) ||
          profile?.displayName,
        headline:
          (typeof linkedInData.headline === 'string' && linkedInData.headline) ||
          (typeof linkedInData.title === 'string' && linkedInData.title) ||
          undefined,
        photoUrl:
          (typeof linkedInData.profilePicture === 'string' && linkedInData.profilePicture) ||
          (typeof linkedInData.photo === 'string' && linkedInData.photo) ||
          profile?.photoURL,
      };
      setLinkedinInput(linkedinUrl);
      setPreview(next);
      return next;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'LinkedIn import failed');
      return null;
    } finally {
      setImporting(false);
    }
  };

  const confirmPreview = async (onSuccess?: () => void): Promise<boolean> => {
    if (!preview) return false;

    setImporting(true);
    try {
      const existingContact = profile?.structuredProfile?.contact || {};
      await updateProfile({
        structuredProfile: {
          ...(profile?.structuredProfile || {}),
          contact: {
            ...existingContact,
            linkedin: preview.linkedinUrl,
            fullName: existingContact.fullName || preview.displayName || profile?.displayName,
          },
        },
      });

      const ok = await processResumeText(preview.resumeText, {
        onSuccess,
        quiet: true,
        hyperlinkUrls: [preview.linkedinUrl],
      });

      if (ok) {
        toast.success('LinkedIn profile confirmed');
        setPreview(null);
        onSuccess?.();
      }
      return ok;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save profile');
      return false;
    } finally {
      setImporting(false);
    }
  };

  const importFromLinkedIn = async (onSuccess?: () => void): Promise<boolean> => {
    const loaded = await loadLinkedInPreview(linkedinInput);
    if (!loaded) return false;
    return confirmPreview(onSuccess);
  };

  const setOAuthPreview = (data: LinkedInImportPreview) => {
    setLinkedinInput(data.linkedinUrl);
    setPreview(data);
  };

  const clearPreview = () => setPreview(null);

  return {
    importing,
    linkedinInput,
    setLinkedinInput,
    preview,
    loadLinkedInPreview,
    confirmPreview,
    importFromLinkedIn,
    setOAuthPreview,
    clearPreview,
  };
};
