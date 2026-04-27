import 'dotenv/config';

async function listModern() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return;

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json() as any;
    if (data.models) {
      const modern = data.models.filter((m: any) => m.name.includes("gemini-2") || m.name.includes("gemini-3"));
      modern.forEach((m: any) => console.log(`${m.name} (${m.supportedGenerationMethods.join(", ")})`));
    }
  } catch (error) {
    console.error(error);
  }
}

listModern();
