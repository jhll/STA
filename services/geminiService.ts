import { GoogleGenAI, Type } from "@google/genai";
import { getConfig } from "./configService";

// Analiza el riesgo del estudiante usando Gemini AI
export async function analyzeStudentRisk(studentData: any) {
  try {
    const { geminiApiKey } = getConfig();

    if (!geminiApiKey) {
      console.warn("Gemini API Key no configurada.");
      return {
        riskLevel: "MEDIUM",
        explanation: "El análisis de IA está temporalmente deshabilitado porque la clave de API de Gemini no está configurada.",
        recommendedInterventions: ["Configurar la API Key de Gemini en el panel de administración."]
      };
    }

    // Inicializamos GoogleGenAI con la clave de API recuperada dinámicamente
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    
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

    // Accedemos a la propiedad .text del resultado
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return null;
  }
}
