// Story image manifest — permanent Journey content.
// Each entry is handcrafted. Replace placeholder text as the Journey is written.

export interface StoryImage {
  id: number; // 1..65
  chapterId: number;
  title: string;
  description: string; // Journey reflection shown to the player
  quote: string; // Placeholder for now; later this may become a quoteId
  wallpaperUnlock?: string;
  achievementUnlock?: string;
}

export const STORY_IMAGES: StoryImage[] = [
  // ============================
  // CHAPTER 1 — ANCIENT GLORY
  // ============================

 {
    id: 1,
    chapterId: 1,
    title: "The First Civilization",
    description:
        "Long before many of the world's great civilizations reached their height, remarkable cities flourished across the Indian subcontinent. Carefully planned streets, advanced engineering, thriving trade, and skilled craftsmanship reveal a society built on innovation and cooperation. Here begins the remarkable journey of one of humanity's oldest continuous civilizations.",
    quote:
        "Civilizations endure not merely through power, but through the ideas they leave behind.",
},
  {
  id: 2,
  chapterId: 1,
  title: "Cities Beyond Their Time",
  description:
    "The cities of the Indus Valley astonished the ancient world with their remarkable planning. Broad streets, sophisticated drainage, standardized construction, and thriving marketplaces reveal a society that valued order, cleanliness, and civic life centuries before many others achieved comparable urban development.",
  quote: "",
},
  {
  id: 3,
  chapterId: 1,
  title: "A Civilization Connected",
  description:
    "Trade routes carried Indian goods across distant lands while skilled artisans produced beautiful pottery, ornaments, seals, and textiles. Prosperity flowed not only from agriculture but also from commerce, connecting this early civilization with cultures far beyond its borders.",
  quote: "",
},
  {
  id: 4,
  chapterId: 1,
  title: "The Age of the Rishis",
  description:
    "As cities faded, new ideas emerged. The Vedas and later the Upanishads explored questions of existence, duty, knowledge, and the nature of reality. These profound traditions laid the philosophical foundations that would shape Indian civilization for thousands of years.",
  quote: "",
},
  {
  id: 5,
  chapterId: 1,
  title: "Paths to Liberation",
  description:
    "Jainism and Buddhism offered new paths centered on compassion, self-discipline, non-violence, and inner awakening. Their teachings spread across Asia while enriching India's long tradition of philosophical diversity and spiritual inquiry.",
  quote: "",
},
  {
  id: 6,
  chapterId: 1,
  title: "The First Empire",
  description:
    "Under Chandragupta Maurya, guided by the wisdom of Kautilya, much of the subcontinent came under a unified administration. Ashoka later transformed imperial power into a message of Dharma, governance, and peace that echoed across continents.",
  quote: "",
},
  {
  id: 7,
  chapterId: 1,
  title: "The Legacy of Knowledge",
  description:
    "Great centers of learning such as Takshashila and Nalanda welcomed scholars from across the world. Mathematics, medicine, philosophy, astronomy, grammar, and countless other disciplines flourished in an atmosphere dedicated to the pursuit of knowledge.",
  quote: "",
},
  {
  id: 8,
  chapterId: 1,
  title: "Ideas That Changed the World",
  description:
    "Indian thinkers developed enduring traditions in Yoga, Ayurveda, linguistics, logic, literature, and philosophy. These ideas crossed mountains and oceans, influencing civilizations while continuing to inspire millions today.",
  quote: "",
},
  {
  id: 9,
  chapterId: 1,
  title: "The Rise of the Golden Age",
  description:
    "With stability restored, India entered an era of extraordinary creativity. Literature, science, architecture, and scholarship flourished together, preparing the stage for one of the greatest periods of cultural achievement in world history.",
  quote: "",
},
  {
  id: 10,
  chapterId: 1,
  title: "The Golden Age of Bharat",
  description:
    "The Gupta era became a beacon of human achievement. Magnificent temples rose alongside breakthroughs in mathematics, astronomy, metallurgy, literature, sculpture, and the arts. Ancient Bharat stood among the world's foremost centers of knowledge and civilization.",
  quote: "",
  wallpaperUnlock: "wallpaper-01",
  achievementUnlock: "achievement-01",
},

  // ============================
  // CHAPTER 2 — GOLDEN AGE
  // ============================

  {
  id: 11,
  chapterId: 2,
  title: "A Beacon to the World",
  description:
    "India entered an age of remarkable prosperity where learning, commerce, and culture flourished together. Scholars, merchants, and travelers journeyed from distant lands to experience the wealth of ideas that radiated across Asia.",
  quote: "",
},
  {
  id: 12,
  chapterId: 2,
  title: "Masters of Numbers",
  description:
    "Indian mathematicians transformed human understanding through ideas that continue to shape the modern world. Concepts such as zero, the decimal system, and advanced arithmetic became foundations upon which future civilizations would build.",
  quote: "",
},
  {
  id: 13,
  chapterId: 2,
  title: "Measuring the Cosmos",
  description:
    "Astronomers carefully observed the heavens, calculating planetary motions, eclipses, and the movement of celestial bodies with extraordinary precision. Their work inspired generations of scientific thought far beyond India's borders.",
  quote: "",
},
  {
  id: 14,
  chapterId: 2,
  title: "Healing Humanity",
  description:
    "Physicians refined systems of medicine that emphasized balance, observation, and careful treatment. Ayurveda, together with advances in surgery and medical knowledge, reflected a civilization deeply committed to understanding human well-being.",
  quote: "",
},
  {
  id: 15,
  chapterId: 2,
  title: "Language Perfected",
  description:
    "Great grammarians preserved and refined Sanskrit with extraordinary precision. Their work demonstrated a sophisticated understanding of language, logic, and communication that continues to influence linguistic scholarship today.",
  quote: "",
},
  {
  id: 16,
  chapterId: 2,
  title: "Stone Becomes Sacred",
  description:
    "Across the land, magnificent temples rose in stone, combining engineering, sculpture, mathematics, and devotion into timeless masterpieces that still inspire awe centuries later.",
  quote: "",
},
  {
  id: 17,
  chapterId: 2,
  title: "Masters of Art",
  description:
    "Painting, sculpture, literature, music, and drama flourished together, celebrating beauty, imagination, and human expression while preserving stories that remain treasured across generations.",
  quote: "",
},
  {
  id: 18,
  chapterId: 2,
  title: "Across the Seas",
  description:
    "Indian merchants sailed across the Indian Ocean, carrying goods, knowledge, beliefs, and culture to distant shores. Maritime trade connected Bharat with kingdoms stretching from East Africa to Southeast Asia.",
  quote: "",
},
  {
  id: 19,
  chapterId: 2,
  title: "The Indian Influence",
  description:
    "Indian philosophy, art, architecture, language, and traditions found new homes across Asia. Rather than conquest, ideas became the greatest ambassadors of Indian civilization.",
  quote: "",
},
  {
  id: 20,
  chapterId: 2,
  title: "A Civilization at Its Zenith",
  description:
    "Knowledge, prosperity, spirituality, science, commerce, and artistic achievement stood together in remarkable harmony. Ancient Bharat had become one of the world's greatest centers of civilization.",
  quote: "",
},
  {
  id: 21,
  chapterId: 2,
  title: "The Legacy Lives On",
  description:
    "The achievements of this golden era would endure long after kingdoms faded. Its discoveries, philosophies, and cultural traditions continued to inspire humanity, leaving a legacy that still shapes the world today.",
  quote: "",
  wallpaperUnlock: "wallpaper-02",
  achievementUnlock: "achievement-02",
},

  // ============================
  // CHAPTER 3 — TROUBLE BEGINS
  // ============================

  {
  id: 22,
  chapterId: 3,
  title: "A Civilization at Its Zenith",
  description:
    "For centuries, Bharat stood among the world's greatest centers of prosperity, knowledge, commerce, and culture. Its universities attracted scholars, its artisans crafted wonders, and its merchants connected civilizations across continents. The wealth and brilliance of this flourishing civilization made it a prize coveted by ambitious powers beyond its frontiers.",
  quote: "",
},
  {
  id: 23,
  chapterId: 3,
  title: "The Bird of Gold",
  description:
    "India's immense prosperity earned it the title of the 'Bird of Gold.' Its fertile lands, thriving cities, skilled artisans, and abundant wealth became legendary across distant kingdoms. From beyond the mountains and seas came ambitious powers, drawn by the hope of possessing even a fragment of this extraordinary civilization.",
  quote: "",
},
  {
  id: 24,
  chapterId: 3,
  title: "The Eternal Brilliance of Golden Somnath",
  description:
    "For centuries, the Somnath Temple stood as one of Bharat's most revered sacred sites, renowned for its spiritual significance, architectural grandeur, and immense prosperity. In 1025 CE, Mahmud of Ghazni attacked and plundered the temple, an event that became one of the most remembered episodes in India's historical memory and symbolized the beginning of centuries of repeated invasions and upheaval across the subcontinent.",
  quote: "",
},
  {
  id: 25,
  chapterId: 3,
  title: "A House Divided",
  description:
    "As the great kingdoms of Bharat competed for power, political unity gradually gave way to regional rivalries. Though India's civilization remained prosperous and culturally vibrant, the absence of a united front weakened its ability to resist determined invaders. The divisions within would soon shape the course of centuries to come.",
  quote: "",
},
  {
  id: 26,
  chapterId: 3,
  title: "The Delhi Sultanate",
  description:
    "Following Muhammad Ghori's victories, the Delhi Sultanate was established in 1206 CE. Over the next three centuries, successive dynasties ruled much of northern India. This period witnessed repeated warfare, the destruction of numerous temples under various rulers, and major political transformations that profoundly altered the course of Indian history.",
  quote: "",
},
  {
  id: 27,
  chapterId: 3,
  title: "The Long Persecution Begins",
  description:
    "With the establishment of successive Sultanate dynasties, large parts of northern India entered a prolonged period of political upheaval. Many Hindu communities experienced warfare, temple destruction under various rulers, and the imposition of jizya at different times. Yet despite these hardships, India's civilizational traditions endured through the resilience of its people.",
  quote: "",
},
  {
  id: 28,
  chapterId: 3,
  title: "The Rise of Vijayanagara",
  description:
    "In 1336 CE, the Vijayanagara Empire emerged as a powerful bastion of Hindu civilization in southern India. Its magnificent temples, thriving cities, flourishing trade, and military strength preserved India's cultural heritage while standing as a formidable barrier against further expansion of the Delhi Sultanate into the south.",
  quote: "",
},
  {
  id: 29,
  chapterId: 3,
  title: "The Rise of Mewar",
  description:
    "As northern India underwent profound political change, the Kingdom of Mewar emerged as one of the strongest defenders of Rajput independence. Its rulers became renowned for their courage, determination, and unwavering commitment to protecting their homeland and preserving their traditions.",
  quote: "",
},
  {
  id: 30,
  chapterId: 3,
  title: "Rana Sanga",
  description:
    "Rana Sanga united many Rajput kingdoms into one of the most powerful military alliances of his age. His determination to resist foreign domination made him one of the greatest warrior-kings in Indian history and a lasting symbol of Rajput valor and sacrifice.",
  quote: "",
},
  {
  id: 31,
  chapterId: 3,
  title: "The Bhakti Movement",
  description:
    "During centuries of political turmoil, saints across Bharat inspired millions through devotion, compassion, and unwavering faith. Their teachings strengthened society, transcended regional and social divisions, and helped preserve India's spiritual traditions through some of its most difficult centuries.",
  quote: "",
},
  {
  id: 32,
  chapterId: 3,
  title: "The Birth of Guru Nanak",
  description:
    "In 1469 CE, Guru Nanak was born in Punjab, beginning a spiritual movement founded on devotion to one God, equality, honest living, and selfless service. His teachings would inspire generations and profoundly shape the spiritual and cultural history of the Indian subcontinent.",
  quote: "",
  wallpaperUnlock: "wallpaper-03",
  achievementUnlock: "achievement-03",
},

  // ============================
  // CHAPTER 4 — LONG NIGHT
  // ============================

  {
  id: 33,
  chapterId: 4,
  title: "The Last Days of the Sultanate",
  description:
    "By the time Guru Nanak was born, the Delhi Sultanate had entered a period of decline. Regional kingdoms asserted their independence, rival rulers competed for power, and the authority of Delhi weakened. As old powers faded, a new conqueror from Central Asia prepared to reshape the destiny of the Indian subcontinent.",
  quote: "",
},
  {
  id: 34,
  chapterId: 4,
  title: "A Short-Sighted Alliance",
  description:
    "As the Delhi Sultanate weakened, rival claimants sought outside help to settle their struggles. Daulat Khan Lodi and Alam Khan invited Babur to intervene against Ibrahim Lodi, while many historical accounts suggest that Rana Sanga also expected Babur's campaign to weaken Delhi. What was intended as a temporary intervention instead opened the door to a new empire that would reshape India's history for centuries.",
  quote: "",
},
  {
  id: 35,
  chapterId: 4,
  title: "The First Battle of Panipat",
  description:
    "On 21 April 1526, Babur defeated Ibrahim Lodi at the First Battle of Panipat using disciplined cavalry, field artillery, and innovative battlefield tactics. The defeat ended the Lodi dynasty and marked the beginning of Mughal rule over large parts of the Indian subcontinent.",
  quote: "",
},
  {
  id: 36,
  chapterId: 4,
  title: "A New Empire Takes Root",
  description:
    "Victory at Panipat gave Babur control of Delhi and Agra, but his position remained far from secure. Many of his own nobles, weary and eager to return to Kabul, doubted whether this new territory could be held. To the west, Rana Sanga's powerful Rajput confederacy watched the fledgling empire with growing resolve. Babur chose to stay and consolidate his gains, setting the stage for the decisive battle to come.",
  quote: "",
},
  {
  id: 37,
  chapterId: 4,
  title: "The Battle of Khanwa",
  description:
    "In 1527 CE, Babur defeated the Rajput confederacy led by Rana Sanga at the Battle of Khanwa, consolidating Mughal power in northern India. In the Baburnama, Babur described the campaign in religious terms and, following the victory, adopted the title 'Ghazi'—a title traditionally used for a victorious warrior fighting on behalf of Islam. The battle became one of the defining turning points in the establishment of the Mughal Empire.",
  quote: "",
},
  {
  id: 38,
  chapterId: 4,
  title: "Maharana Pratap",
  description:
    "Maharana Pratap of Mewar refused to submit to Mughal authority despite immense military and economic disadvantages. His determined resistance, exemplified by the Battle of Haldighati and his continued struggle from the Aravalli hills, made him an enduring symbol of courage, sacrifice, and the resolve to preserve independence.",
  quote: "",
},
  {
  id: 39,
  chapterId: 4,
  title: "Akbar's Experiment",
  description:
    "Unlike many rulers of his age, Akbar pursued policies of greater religious accommodation. He abolished the jizya for a time, invited scholars of different faiths to debate at the Ibadat Khana, and promoted the concept of Sulh-i-Kul (universal peace). His religious experiments and independent authority over religious matters drew strong opposition from sections of the orthodox Islamic clergy, who viewed many of his policies as contrary to Islamic orthodoxy.",
  quote: "",
},
  {
  id: 40,
  chapterId: 4,
  title: "The Khalsa is Born",
  description:
    "In 1699 CE, Guru Gobind Singh established the Khalsa, transforming the Sikh community into a disciplined order committed to courage, justice, and the defense of righteousness. Inspired by the sacrifices of the earlier Sikh Gurus, the Khalsa became a powerful force against oppression and one of the defining institutions in Indian history.",
  quote: "",
},
  {
  id: 41,
  chapterId: 4,
  title: "Chhatrapati Shivaji Maharaj",
  description:
    "In the seventeenth century, Chhatrapati Shivaji Maharaj established the Maratha state upon the ideal of Swarajya—self-rule. Through brilliant military strategy, an efficient administration, and a powerful navy, he challenged Mughal expansion and inspired generations with the vision of an independent Indian kingdom.",
  quote: "",
},
  {
  id: 42,
  chapterId: 4,
  title: "The Maratha Confederacy",
  description:
    "After the death of Chhatrapati Shivaji Maharaj, the Marathas continued to expand under capable leaders and Peshwas. Within decades, they emerged as the dominant political power across much of the Indian subcontinent, dramatically reducing Mughal authority and rekindling the ideal of indigenous self-rule.",
  quote: "",
},
  {
  id: 43,
  chapterId: 4,
  title: "The Sunset of the Mughals",
  description:
    "By the eighteenth century, the Mughal Empire had entered a long decline. Regional powers such as the Marathas, Sikhs, and others asserted their independence, while the emperor's authority steadily diminished. As the old empire faded, a new foreign power quietly prepared to reshape India's destiny once again.",
  quote: "",
  wallpaperUnlock: "wallpaper-04",
  achievementUnlock: "achievement-04",
},

  // ============================
  // CHAPTER 5 — FINAL BLOW
  // ============================

  {
  id: 44,
  chapterId: 5,
  title: "Merchants from the West",
  description:
    "European trading companies arrived on India's shores seeking spices, textiles, and commerce. Among them, the English East India Company steadily expanded its influence, transforming from a commercial enterprise into an ambitious political power whose actions would reshape the destiny of the Indian subcontinent.",
  quote: "",
},
  {
  id: 45,
  chapterId: 5,
  title: "The Battle of Plassey",
  description:
    "In 1757 CE, the East India Company defeated the Nawab of Bengal at the Battle of Plassey through military action and political intrigue. The victory transformed the Company from a trading enterprise into a territorial power, marking the beginning of British political dominance in India.",
  quote: "",
},
  {
  id: 46,
  chapterId: 5,
  title: "Company Rule",
  description:
    "As the East India Company expanded its authority, vast regions of India came under corporate rule. Heavy taxation, economic exploitation, the decline of traditional industries, and political annexations transformed the lives of millions, sowing the seeds of growing resentment across the subcontinent.",
  quote: "",
},
  {
  id: 47,
  chapterId: 5,
  title: "The First War of Independence",
  description:
    "In 1857, soldiers, rulers, and ordinary people across northern and central India rose against the East India Company. Though the uprising was ultimately suppressed, it became a defining moment in India's struggle against colonial rule and inspired future generations to continue the fight for freedom.",
  quote: "",
},
  {
  id: 48,
  chapterId: 5,
  title: "The British Raj",
  description:
    "Following the uprising of 1857, the British Crown dissolved the East India Company's rule and assumed direct control over India. The British Raj centralized imperial authority while expanding railways, administration, and infrastructure, but also tightened colonial control over the subcontinent, shaping India's political, economic, and social landscape for nearly ninety years.",
  quote: "",
},
  {
  id: 49,
  chapterId: 5,
  title: "The Indian Renaissance",
  description:
    "The nineteenth century witnessed a remarkable awakening of Indian thought. Reformers, educators, writers, and spiritual leaders challenged social evils, promoted modern education, and revived confidence in India's civilizational heritage. This intellectual resurgence laid the foundation for a new national consciousness.",
  quote: "",
},
  {
  id: 50,
  chapterId: 5,
  title: "The Indian National Congress",
  description:
    "Founded in 1885, the Indian National Congress became the principal platform through which Indians sought greater political participation and, eventually, complete independence. Over time, it united leaders and citizens from across the country in a common national cause.",
  quote: "",
},
  {
  id: 51,
  chapterId: 5,
  title: "Mahatma Gandhi",
  description:
    "Under the leadership of Mahatma Gandhi, India's struggle for freedom became a nationwide mass movement. Through satyagraha, non-violent resistance, and civil disobedience, millions of ordinary Indians united to challenge colonial rule and demand complete independence.",
  quote: "",
},
  {
  id: 52,
  chapterId: 5,
  title: "The Final Push for Freedom",
  description:
    "India's final struggle for independence drew strength from many paths. The sacrifices of revolutionaries, the leadership of Subhas Chandra Bose and the Indian National Army, the Quit India Movement, and countless ordinary Indians together created irresistible momentum that brought British rule to its end.",
  quote: "",
},
  {
  id: 53,
  chapterId: 5,
  title: "Partition",
  description:
    "In 1947, British India was partitioned into India and Pakistan. The division triggered one of the largest and most traumatic mass migrations in human history. Widespread communal violence claimed countless lives, devastated families, and displaced millions, leaving scars that continue to shape the history and memory of the subcontinent.",
  quote: "",
},
  {
  id: 54,
  chapterId: 5,
  title: "We, the People of India",
  description:
    "On 26 January 1950, India adopted its Constitution and became a sovereign democratic republic. Guided by the ideals of justice, liberty, equality, and fraternity, the Constitution transformed a newly independent nation into the world's largest democracy, laying the foundation for a united and modern Bharat.",
  quote: "",
  wallpaperUnlock: "wallpaper-05",
  achievementUnlock: "achievement-05",
},

  // ============================
  // CHAPTER 6 — BHARAT RISING
  // ============================

  {
  id: 55,
  chapterId: 6,
  title: "Building a Nation",
  description:
    "Independence was only the beginning. India faced the immense task of uniting hundreds of princely states, rebuilding institutions, strengthening democracy, and transforming a diverse civilization into a modern republic. Through determination and constitutional governance, the foundations of a new Bharat were laid.",
  quote: "",
},
  {
  id: 56,
  chapterId: 6,
  title: "Feeding a Billion",
  description:
    "Through scientific innovation, improved irrigation, and the determination of millions of farmers, the Green Revolution transformed India from a food-deficient nation into one capable of feeding its growing population. It became one of independent India's greatest achievements in nation-building.",
  quote: "",
},
  {
  id: 57,
  chapterId: 6,
  title: "Reaching for the Stars",
  description:
    "In 1969, the Indian Space Research Organisation (ISRO) was founded with a vision to harness space technology for national development. From humble beginnings, India built one of the world's most respected space programs, demonstrating that scientific excellence and innovation could transform the future of a developing nation.",
  quote: "",
},
  {
  id: 58,
  chapterId: 6,
  title: "Smiling Buddha",
  description:
    "In 1974, India demonstrated its nuclear capability with its first successful nuclear test at Pokhran, followed by a series of tests in 1998 that established it as a declared nuclear weapons state. India maintained a doctrine centered on credible minimum deterrence and a No First Use policy, strengthening its strategic security while emphasizing responsible stewardship of nuclear technology.",
  quote: "",
},
  {
  id: 59,
  chapterId: 6,
  title: "Opening the Economy",
  description:
    "In 1991, India launched sweeping economic reforms that liberalized trade, reduced government controls, and encouraged private enterprise. These reforms accelerated economic growth, expanded opportunities, and marked the beginning of India's emergence as a major force in the global economy.",
  quote: "",
},
  {
  id: 60,
  chapterId: 6,
  title: "Digital India",
  description:
    "The digital revolution transformed the way Indians communicate, learn, govern, and innovate. From digital payments and online public services to world-leading digital infrastructure, technology became a powerful force driving inclusion, entrepreneurship, and economic growth across the nation.",
  quote: "",
},
  {
  id: 61,
  chapterId: 6,
  title: "Chandrayaan",
  description:
    "India's Chandrayaan missions demonstrated the nation's growing leadership in space exploration. With Chandrayaan-3's successful soft landing near the Moon's south pole in 2023, India became the first country to achieve this historic feat, inspiring millions and showcasing the power of scientific excellence and determination.",
  quote: "",
},
  {
  id: 62,
  chapterId: 6,
  title: "The World's Largest Democracy",
  description:
    "For more than seven decades, India has upheld one of history's greatest democratic experiments. Regular elections, an independent constitutional framework, and the participation of hundreds of millions of citizens have made the Republic of India the world's largest democracy and a model of democratic continuity.",
  quote: "",
},
  {
  id: 63,
  chapterId: 6,
  title: "Vishwaguru",
  description:
    "Rooted in one of the world's oldest continuous civilizations, modern India aspires to contribute to humanity through knowledge, innovation, diplomacy, sustainable development, and the timeless ideals of Vasudhaiva Kutumbakam—'the world is one family.' The journey of Bharat continues with confidence, responsibility, and a vision for global leadership.",
  quote: "",
},
  {
  id: 64,
  chapterId: 6,
  title: "The India of Tomorrow",
  description:
    "The story of Bharat is still being written. Powered by its youth, scientific innovation, entrepreneurship, cultural confidence, and democratic spirit, India looks toward the future with the ambition to build a prosperous, secure, and developed nation while contributing to the progress of all humanity.",
  quote: "",
},
  {
  id: 65,
  chapterId: 6,
  title: "The Eternal Civilization",
  description:
    "For thousands of years, Bharat has endured through triumph, hardship, renewal, and transformation. From the earliest cities to the modern republic, each generation has added a new chapter to an unbroken civilizational journey. The story does not end here—it now belongs to those who will carry India's heritage, values, and aspirations into the future.",
  quote: "The journey of Bharat continues... and so does yours.",
  wallpaperUnlock: "wallpaper-06",
  achievementUnlock: "achievement-06",
},
];

export function storyById(id: number): StoryImage | null {
  return STORY_IMAGES.find((s) => s.id === id) ?? null;
}