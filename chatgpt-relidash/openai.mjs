import OpenAI from "openai";

export async function handler(event) {

  try {

    const { prompt } = JSON.parse(event.body);

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "You are the AI assistant for Reli AI. Reli AI sells AI voice receptionists to local service businesses like plumbers, HVAC, salons, and barbershops."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        text: completion.choices[0].message.content
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };

  }

}
