
import { GoogleGenAI, Type } from "@google/genai";

// Analyzes student risk using Gemini AI
export async function analyzeStudentRisk(studentData: any) {
  try {
    // Always initialize GoogleGenAI inside the function to pick up the latest API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Analiza el perfil del siguiente estudiante de la Facultad de Ciencia Químico Biológica y determina su nivel de riesgo de deserción (LOW, MEDIUM, HIGH). 
    Proporciona una breve explicación de los factores de riesgo más influyentes basados en datos académicos, personales e institucionales.
    
    Datos del estudiante:
    ${JSON.stringify(studentData, null, 2)}
    
    Responde estrictamente en formato JSON con las llaves: "riskLevel", "explanation", "recommendedInterventions".`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, description: "LOW, MEDIUM, or HIGH" },
            explanation: { type: Type.STRING },
            recommendedInterventions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ["riskLevel", "explanation", "recommendedInterventions"]
        }
      }
    });

    // Directly access the .text property of GenerateContentResponse
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return null;
  }
}
