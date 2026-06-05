const { execSync } = require("child_process");
try {
  const result = execSync("npx vercel env pull .env.test --yes");
  console.log("Pulled successfully");
} catch(e) {
  console.log("Error pulling");
}
