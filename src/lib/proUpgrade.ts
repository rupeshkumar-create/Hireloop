import { toast } from 'sonner';

export function showProRequiredToast(message = 'Upgrade to Pro to use this feature.') {
  toast.error(message, {
    duration: 6000,
    action: {
      label: 'View plans',
      onClick: () => {
        window.location.href = '/settings#billing-plan';
      },
    },
  });
}
