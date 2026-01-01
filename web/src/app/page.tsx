import { RestaurantList } from "@/components/restaurant-list"
import { YoutubeAnalyzer } from "@/components/youtube-analyzer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PodcastData } from "@/types/restaurant"

// For now, we'll use the sample data from the JSON file
// Later this will come from an API
const sampleData: PodcastData = {
  "episode_info": {
    "video_id": "rGS7OCpZ8J4",
    "video_url": "https://www.youtube.com/watch?v=rGS7OCpZ8J4",
    "language": "he",
    "analysis_date": "2026-01-01"
  },
  "restaurants": [
    {
      "name_hebrew": "קוקוזן",
      "name_english": "Kokuzen",
      "location": {
        "city": "תל אביב",
        "neighborhood": "פלורנטין",
        "address": "רחוב פלורנטין",
        "region": "Center"
      },
      "cuisine_type": "Japanese",
      "status": "new_opening",
      "price_range": "mid-range",
      "host_opinion": "positive",
      "host_comments": "זה בית הקפה היפני שלהם... המקום מקסים... השקיעו ויצא מהמם... העיצוב של המקום וזה ממש כאילו ביג טיים זן... יש שער טורי בכניסה... ממש עיצוב שאתה כאילו נכנס למקדש... יש בריכת דגי קוי... כל אלמנט שם חשבו עליו לעומק",
      "menu_items": [
        {
          "item_name": "פנקייקים יפנים עם נוטלה",
          "description": "פנקייקים יפנים המתוקים עם שוקולד וקצפת",
          "price": null,
          "recommendation_level": "highly_recommended"
        },
        {
          "item_name": "סנדו עם סלת ביצים",
          "description": "סנדו יפני עם סלת ביצים, מזכיר קונבי ביפן",
          "price": null,
          "recommendation_level": "highly_recommended"
        }
      ],
      "special_features": ["עיצוב יפני אותנטי", "בריכת דגי קוי", "שער טורי"],
      "contact_info": {
        "hours": null,
        "phone": null,
        "website": null
      },
      "business_news": null,
      "mention_context": "new_opening"
    },
    {
      "name_hebrew": "פוקה",
      "name_english": "Puka",
      "location": {
        "city": "תל אביב",
        "neighborhood": null,
        "address": null,
        "region": "Center"
      },
      "cuisine_type": "Poke Bowl",
      "status": "open",
      "price_range": "mid-range",
      "host_opinion": "positive",
      "host_comments": "זה הפוקה החדש שפתח... הם עושים פוקה באול מדהים... הטונה שלהם מטורפת... הם משתמשים בטונה יבואנית איכותית",
      "menu_items": [
        {
          "item_name": "פוקה בול עם טונה",
          "description": "פוקה בול עם טונה יבואנית איכותית",
          "price": null,
          "recommendation_level": "highly_recommended"
        }
      ],
      "special_features": ["טונה יבואנית איכותית"],
      "contact_info": {
        "hours": null,
        "phone": null,
        "website": null
      },
      "business_news": null,
      "mention_context": "review"
    },
    {
      "name_hebrew": "בלנק",
      "name_english": "Blank",
      "location": {
        "city": "תל אביב",
        "neighborhood": "נווה צדק",
        "address": null,
        "region": "Center"
      },
      "cuisine_type": "Italian",
      "status": "open",
      "price_range": "expensive",
      "host_opinion": "mixed",
      "host_comments": "המקום יפה מאוד... אבל האוכל לא בא לידי ביטוי... הפיצה לא הייתה משהו מיוחד... השירות היה בסדר אבל לא יותר",
      "menu_items": [
        {
          "item_name": "פיצה",
          "description": "פיצה רגילה, לא מיוחדת",
          "price": null,
          "recommendation_level": "not_recommended"
        }
      ],
      "special_features": ["עיצוב יפה"],
      "contact_info": {
        "hours": null,
        "phone": null,
        "website": null
      },
      "business_news": null,
      "mention_context": "review"
    }
  ],
  "food_trends": ["מטבח יפני", "פוקה בולס", "ברנץ' איכותי", "קונספטים חדשניים"],
  "episode_summary": "בפרק זה נסקרו מספר מסעדות חדשות ופתיחות חדשות בתל אביב, עם דגש על מטבח יפני ומקומות ברנץ' איכותיים. המנחה היה מתלהב במיוחד מקוקוזן - בית הקפה היפני בפלורנטין, ושיבח את הפוקא החדש של פוקה. לעומת זאת, הביע אכזבה מבלנק בנווה צדק."
}

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Where2Eat</h1>
          <p className="text-xl text-muted-foreground">
            גלו מסעדות מומלצות מפודקאסטים של גורמי
          </p>
        </header>

        <Tabs defaultValue="restaurants" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="restaurants">
              רשימת מסעדות ({sampleData.restaurants.length})
            </TabsTrigger>
            <TabsTrigger value="analyze">
              נתח סרטון YouTube
            </TabsTrigger>
          </TabsList>

          <TabsContent value="restaurants" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>מסעדות מהפודקאסט האחרון</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      נותח ב-{sampleData.episode_info.analysis_date}
                    </p>
                  </div>
                  <a 
                    href={sampleData.episode_info.video_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    צפה בפודקאסט המקורי ↗
                  </a>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-right">{sampleData.episode_summary}</p>
                  <div className="flex flex-wrap gap-1">
                    {sampleData.food_trends.map((trend, index) => (
                      <Badge key={index} variant="secondary">
                        {trend}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <RestaurantList restaurants={sampleData.restaurants} />
          </TabsContent>

          <TabsContent value="analyze" className="space-y-6">
            <YoutubeAnalyzer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
