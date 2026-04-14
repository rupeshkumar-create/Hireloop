<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Hireschema - Remote AI Recruiting Agent

The AI-powered platform exclusively for remote job seekers. Find, track, and land remote roles worldwide.

## Features

- **Resume Parsing & Optimization:** Tailor your resume specifically for remote job postings using AI.
- **Automated Job Matches:** Receive daily curated remote job opportunities based on your career paths and preferences.
- **Cold Email Generation:** Generate highly personalized, professional cold emails instantly.
- **Job Application Tracking:** A built-in Kanban board/list view to track your applications from 'Saved' to 'Interviewing'.
- **Anti-Slop AI Humanizer:** Keep your emails and tailored resumes concise, active, and free of robotic AI jargon.

## Run Locally

**Prerequisites:** Node.js v18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment variables by copying `.env.example` to `.env` and filling in your keys (OpenAI, Serper, Resend, Firebase):
   ```bash
   cp .env.example .env
   ```

3. Run the app locally:
   ```bash
   npm run dev
   ```

## Deployment

This project is configured to deploy seamlessly on Vercel.

1. Connect your GitHub repository to Vercel.
2. Leave the Root Directory blank (if deploying from the root of this repository).
3. Ensure you add the necessary Environment Variables in the Vercel Dashboard before deploying.
