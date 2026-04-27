import 'dotenv/config';

async function findModel() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_API_KEY not found in .env");
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json() as any;
    if (!data.models) {
      console.error("No models property in response:", data);
      return;
    }
    const flash = data.models.find((m: any) => m.name.includes("gemini-1.5-flash"));
    const pro = data.models.find((m: any) => m.name.includes("gemini-1.5-pro"));
    const gpro = data.models.find((m: any) => m.name === "models/gemini-pro");
    
    console.log("Flash:", flash ? flash.name : "NOT FOUND");
    console.log("Pro:", pro ? pro.name : "NOT FOUND");
    console.log("Gemini Pro:", gpro ? gpro.name : "NOT FOUND");
    
    if (flash) console.log("Flash Methods:", flash.supportedGenerationMethods);
    if (pro) console.log("Pro Methods:", pro.supportedGenerationMethods);
  } catch (error) {
    console.error("Error finding models:", error);
  }
}

findModel();
