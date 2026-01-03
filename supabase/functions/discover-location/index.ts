import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface LocationRequest {
  location: string;
}

interface Place {
  name: string;
  description: string;
  rating?: number;
}

interface Restaurant {
  name: string;
  cuisine: string;
  rating?: number;
}

interface Activity {
  name: string;
  description: string;
}

interface Food {
  name: string;
  description: string;
}

interface LocationData {
  places: Place[];
  restaurants: Restaurant[];
  activities: Activity[];
  foods: Food[];
}

const locationDatabase: Record<string, LocationData> = {
  paris: {
    places: [
      {
        name: 'Eiffel Tower',
        description: 'Iconic iron lattice tower and the symbol of Paris, offering stunning views of the city from multiple levels',
        rating: 4.8,
      },
      {
        name: 'Louvre Museum',
        description: 'World\'s largest art museum with iconic works like the Mona Lisa and Venus de Milo. Home to over 38,000 artworks',
        rating: 4.7,
      },
      {
        name: 'Notre-Dame Cathedral',
        description: 'Medieval Catholic cathedral and masterpiece of Gothic architecture. Famous for its rose windows and gargoyles',
        rating: 4.6,
      },
      {
        name: 'Arc de Triomphe',
        description: 'Triumphal arch honoring military victories with views from the rooftop terrace over the city',
        rating: 4.5,
      },
    ],
    restaurants: [
      {
        name: 'Le Jules Verne',
        cuisine: 'French Fine Dining - Michelin-starred restaurant in Eiffel Tower',
        rating: 4.5,
      },
      {
        name: 'L\'Ami Jean',
        cuisine: 'Traditional French - Cozy bistro with authentic French cuisine',
        rating: 4.4,
      },
      {
        name: 'Bouchon du Palais Royal',
        cuisine: 'French Bistro - Classic Lyonnais cuisine in the heart of Paris',
        rating: 4.6,
      },
    ],
    activities: [
      {
        name: 'Seine River Cruise',
        description: 'Romantic boat ride along the Seine with stunning views of monuments and bridges',
      },
      {
        name: 'Montmartre Walking Tour',
        description: 'Explore the artistic heart of Paris with charming streets and the Basilica of Sacré-Cœur',
      },
      {
        name: 'Versailles Palace Tour',
        description: 'Visit the grand royal palace with opulent gardens and historical rooms',
      },
    ],
    foods: [
      {
        name: 'Croissants',
        description: 'Buttery, flaky pastries perfect for breakfast, best enjoyed with coffee',
      },
      {
        name: 'Escargots',
        description: 'Traditional French snails cooked in garlic butter sauce',
      },
      {
        name: 'French Macarons',
        description: 'Delicate almond meringue cookies with various flavors and fillings',
      },
    ],
  },
  tokyo: {
    places: [
      {
        name: 'Senso-ji Temple',
        description: 'Ancient Buddhist temple from 645 AD and Tokyo\'s oldest, featuring the iconic red lantern',
        rating: 4.7,
      },
      {
        name: 'Tokyo Skytree',
        description: 'Tallest structure in Japan with observation decks offering 360-degree city views',
        rating: 4.6,
      },
      {
        name: 'Meiji Shrine',
        description: 'Shinto shrine surrounded by peaceful forest, dedicated to the Meiji Emperor',
        rating: 4.8,
      },
      {
        name: 'Imperial Palace',
        description: 'Residence of the Japanese Emperor with beautiful gardens and historic grounds',
        rating: 4.4,
      },
    ],
    restaurants: [
      {
        name: 'Sukiyabashi Jiro',
        cuisine: 'Sushi - Legendary 3-Michelin-star sushi restaurant',
        rating: 4.9,
      },
      {
        name: 'Ichiran Ramen',
        cuisine: 'Ramen - Famous chain with rich tonkotsu broth',
        rating: 4.5,
      },
      {
        name: 'Tempura Kondo',
        cuisine: 'Tempura - Crispy battered seafood and vegetables by a master chef',
        rating: 4.7,
      },
    ],
    activities: [
      {
        name: 'Shibuya Crossing Experience',
        description: 'Witness the world\'s busiest pedestrian crossing from the Starbucks overlooking it',
      },
      {
        name: 'Tsukiji Fish Market Tour',
        description: 'Early morning visit to the famous fish market with tuna auctions and fresh seafood',
      },
      {
        name: 'Karaoke Night',
        description: 'Experience Japanese karaoke culture in a private booth with friends',
      },
    ],
    foods: [
      {
        name: 'Sushi',
        description: 'Fresh raw fish and seafood served on seasoned rice, a quintessential Japanese dish',
      },
      {
        name: 'Ramen',
        description: 'Rich noodle soup with various broths and authentic toppings',
      },
      {
        name: 'Okonomiyaki',
        description: 'Savory Japanese pancake with vegetables, meat, and special sauce',
      },
    ],
  },
  'new york': {
    places: [
      {
        name: 'Statue of Liberty',
        description: 'Iconic symbol of freedom with accessible torch and crown for visitors',
        rating: 4.7,
      },
      {
        name: 'Central Park',
        description: 'Massive urban park in Manhattan with lakes, meadows, and iconic landmarks',
        rating: 4.8,
      },
      {
        name: 'Times Square',
        description: 'Bright lights and bustling entertainment district with Broadway theaters',
        rating: 4.5,
      },
      {
        name: 'Empire State Building',
        description: 'Historic Art Deco skyscraper with observation decks on the 86th and 102nd floors',
        rating: 4.6,
      },
    ],
    restaurants: [
      {
        name: 'Katz\'s Delicatessen',
        cuisine: 'Jewish Deli - Famous for pastrami on rye and mile-high sandwiches',
        rating: 4.6,
      },
      {
        name: 'Peter Luger Steak House',
        cuisine: 'Steakhouse - Iconic steakhouse with dry-aged beef',
        rating: 4.7,
      },
      {
        name: 'Joe\'s Pizza',
        cuisine: 'Pizzeria - Classic NYC pizza slices from multiple locations',
        rating: 4.5,
      },
    ],
    activities: [
      {
        name: 'Broadway Show',
        description: 'World-class theater performances at historic theaters',
      },
      {
        name: 'Brooklyn Bridge Walk',
        description: 'Scenic walk across the historic bridge with Manhattan skyline views',
      },
      {
        name: 'Museum of Natural History',
        description: 'World-renowned museum with dinosaur fossils and cultural exhibits',
      },
    ],
    foods: [
      {
        name: 'New York Pizza',
        description: 'Thin-crust pizza sold by the slice, the quintessential NYC street food',
      },
      {
        name: 'Hot Dogs',
        description: 'Classic street food from iconic vendors like Sabrett or Nathan\'s',
      },
      {
        name: 'Bagels with Lox',
        description: 'Cream cheese and smoked salmon on a toasted bagel',
      },
    ],
  },
  london: {
    places: [
      {
        name: 'Big Ben',
        description: 'Iconic clock tower and symbol of London, officially the Elizabeth Tower',
        rating: 4.7,
      },
      {
        name: 'Tower of London',
        description: 'Historic castle home to the Crown Jewels with fascinating exhibits',
        rating: 4.6,
      },
      {
        name: 'British Museum',
        description: 'World-famous museum with vast collections including the Rosetta Stone',
        rating: 4.8,
      },
      {
        name: 'Westminster Abbey',
        description: 'Gothic abbey where royal coronations and weddings take place',
        rating: 4.5,
      },
    ],
    restaurants: [
      {
        name: 'The Ledbury',
        cuisine: 'Modern European - 2-Michelin-star restaurant',
        rating: 4.6,
      },
      {
        name: 'Dishoom',
        cuisine: 'Indian - Popular Bombay-style restaurant',
        rating: 4.5,
      },
      {
        name: 'The Ivy',
        cuisine: 'British - Classic English restaurant in Covent Garden',
        rating: 4.4,
      },
    ],
    activities: [
      {
        name: 'Thames River Cruise',
        description: 'Sightseeing cruise along the River Thames past major landmarks',
      },
      {
        name: 'West End Theatre',
        description: 'Attend a world-class theatrical production in historic theaters',
      },
      {
        name: 'Notting Hill Walking Tour',
        description: 'Explore colorful houses and charming streets in the trendy neighborhood',
      },
    ],
    foods: [
      {
        name: 'Fish and Chips',
        description: 'Classic British fried fish with chips, best enjoyed with malt vinegar',
      },
      {
        name: 'Afternoon Tea',
        description: 'Traditional tea service with sandwiches, scones, and pastries',
      },
      {
        name: 'Sunday Roast',
        description: 'Roasted meat with Yorkshire pudding and gravy',
      },
    ],
  },
  dubai: {
    places: [
      {
        name: 'Burj Khalifa',
        description: 'World\'s tallest building with observation decks and fine dining',
        rating: 4.8,
      },
      {
        name: 'Dubai Mall',
        description: 'Massive shopping and entertainment complex with over 1200 stores',
        rating: 4.6,
      },
      {
        name: 'Palm Jumeirah',
        description: 'Artificial archipelago shaped like a palm tree with luxury properties',
        rating: 4.7,
      },
      {
        name: 'Dubai Fountain',
        description: 'World\'s largest choreographed fountain with impressive water displays',
        rating: 4.7,
      },
    ],
    restaurants: [
      {
        name: 'At.mosphere',
        cuisine: 'International Fine Dining - In Burj Khalifa with city views',
        rating: 4.7,
      },
      {
        name: 'Pierchic',
        cuisine: 'Seafood - Fine dining on a pier over the Arabian Gulf',
        rating: 4.6,
      },
      {
        name: 'Al Mallah',
        cuisine: 'Middle Eastern - Famous shawarma and kebab restaurant',
        rating: 4.5,
      },
    ],
    activities: [
      {
        name: 'Desert Safari',
        description: 'Thrilling dune bashing with camel rides and traditional entertainment',
      },
      {
        name: 'Dubai Fountain Show',
        description: 'Spectacular choreographed fountain display set to music',
      },
      {
        name: 'Ski Dubai',
        description: 'Indoor skiing in the desert with real snow',
      },
    ],
    foods: [
      {
        name: 'Shawarma',
        description: 'Middle Eastern wrap with meat, tahini, and vegetables',
      },
      {
        name: 'Arabic Mezze',
        description: 'Selection of small dishes including hummus, tabbouleh, and falafel',
      },
      {
        name: 'Camel Meat',
        description: 'Traditional Emirati delicacy with unique flavor',
      },
    ],
  },
};

function generateGenericData(location: string): LocationData {
  const capitalizedLocation = location.charAt(0).toUpperCase() + location.slice(1);
  return {
    places: [
      {
        name: `${capitalizedLocation} City Center`,
        description: 'Historic downtown area with shops, restaurants, and cultural landmarks',
        rating: 4.3,
      },
      {
        name: `${capitalizedLocation} Museum`,
        description: 'Local history and culture exhibits showcasing regional heritage',
        rating: 4.2,
      },
      {
        name: `${capitalizedLocation} Park`,
        description: 'Beautiful green space perfect for relaxation and outdoor activities',
        rating: 4.4,
      },
    ],
    restaurants: [
      {
        name: `The ${capitalizedLocation} Grill`,
        cuisine: 'Local Cuisine - Authentic traditional regional dishes',
        rating: 4.3,
      },
      {
        name: `${capitalizedLocation} Cafe`,
        cuisine: 'International - Diverse menu with local and global flavors',
        rating: 4.2,
      },
    ],
    activities: [
      {
        name: 'City Walking Tour',
        description: 'Explore the main attractions and hidden gems on foot with local guides',
      },
      {
        name: 'Local Market Visit',
        description: 'Experience authentic local shopping with traditional goods and crafts',
      },
    ],
    foods: [
      {
        name: 'Local Specialty',
        description: 'Traditional dish unique to this region with authentic preparation',
      },
      {
        name: 'Street Food',
        description: 'Popular local street food options offering authentic flavors',
      },
    ],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { location }: LocationRequest = body;

    if (!location) {
      return new Response(
        JSON.stringify({ error: 'Location parameter is required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (typeof location !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Location must be a string' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const sanitizedLocation = location.toLowerCase().trim();
    if (sanitizedLocation.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Location cannot be empty' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (sanitizedLocation.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Location is too long' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const data = locationDatabase[sanitizedLocation] || generateGenericData(location);

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});