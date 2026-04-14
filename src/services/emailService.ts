const sendResendEmail = async (payload: any) => {
  try {
    const response = await fetch('/api/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    if (!response.ok) {
      console.error('Resend error response:', data);
      throw new Error(data.error || 'Failed to send email');
    }
    return data;
  } catch (error) {
    console.error('Error in sendResendEmail:', error);
    throw error;
  }
};

export const sendSignupEmail = async (userEmail: string, userName: string) => {
  return await sendResendEmail({
    from: 'Hireschema <onboarding@hireschema.com>',
    to: [userEmail],
    subject: 'Welcome to Hireschema',
    html: `
      <div style="font-family: sans-serif; color: #18181b;">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">Welcome to Hireschema.</h1>
        <p style="font-size: 16px; margin-bottom: 24px;">Your AI recruiting agent is ready. Upload your resume to start getting remote job matches.</p>
        <a href="https://hireschema.com/dashboard" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">Go to Dashboard</a>
      </div>
    `,
  });
};

export const sendDailyJobAlertsEmail = async (userEmail: string, jobs: any[]) => {
  if (!jobs || jobs.length === 0) return null;

  return await sendResendEmail({
    from: 'Hireschema Alerts <alerts@hireschema.com>',
    to: [userEmail],
    subject: `Your Daily Job Matches - ${jobs.length} New Roles`,
    html: `
      <div>
        <h2>We found ${jobs.length} new jobs for you today!</h2>
        <ul>
          ${jobs.map(job => `
            <li style="margin-bottom: 12px;">
              <strong>${job.title}</strong> at ${job.company}<br/>
              <a href="${job.url}">Apply Here</a>
            </li>
          `).join('')}
        </ul>
      </div>
    `,
  });
};
