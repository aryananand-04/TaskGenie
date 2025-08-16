import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    // Replace this with your actual GPT logic
    const result = `Pretend response from interngpt for: "${prompt}"`;

    return NextResponse.json({ result });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
