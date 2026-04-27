import 'dotenv/config';

async function listAllNames() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return;

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json() as any;
    if (data.models) {
      data.models.forEach((m: any) => console.log(m.name));
    } else {
      console.log("No models:", data);
    }
  } catch (error) {
    console.error(error);
  }
}

listAllNames();
