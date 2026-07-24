import { NextRequest, NextResponse } from "next/server";
import { getGamesAmerica } from "nintendo-switch-eshop";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const games = await getGamesAmerica();
    
    const searchTerms = query.toLowerCase().trim().split(' ').filter(Boolean);
    
    // Find games matching all terms
    const matches = games.filter(g => {
      const title = g.title.toLowerCase();
      return searchTerms.every(term => title.includes(term));
    });

    if (matches.length === 0) {
      return NextResponse.json({ error: "No game found" }, { status: 404 });
    }
    
    // Sort by shortest title (usually the base game and not a DLC/Bundle)
    matches.sort((a, b) => a.title.length - b.title.length);
    const bestMatch = matches[0];

    return NextResponse.json({ 
      title: bestMatch.title,
      priceUSD: bestMatch.msrp || 0
    });
    
  } catch (err: any) {
    console.error("Error fetching eshop price:", err);
    return NextResponse.json({ error: "Failed to fetch from eShop" }, { status: 500 });
  }
}
