const vision = require('@google-cloud/vision');

// Google Vision API Client
const client = new vision.ImageAnnotatorClient({
  keyFilename: 'serviceAccountKey.json',
});

// Helper: lower-case array
function toLower(arr) {
  return arr.map((x) => x.toLowerCase());
}

// Helper: fuzzy match (partial matches)
function fuzzyMatch(label, keyword) {
  return label.includes(keyword) || keyword.includes(label);
}

// Score calculator
function scoreCategory(labels, keywords) {
  let score = 0;
  labels.forEach(label => {
    keywords.forEach(key => {
      if (fuzzyMatch(label, key)) score += 1;
    });
  });
  return score;
}

// Auto Categorization
async function autoCategorize(imageUrl) {
  const [result] = await client.labelDetection(imageUrl);
  const labels = toLower(result.labelAnnotations.map(l => l.description));

  console.log("🔥 Vision labels:", labels);

  // -----------------------------
  // CATEGORY KEYWORDS
  // -----------------------------

  const potholeKeywords = [
    'pothole', 'sinkhole', 'crack', 'hole', 'road surface',
    'asphalt', 'tar', 'puddle', 'damaged road'
  ];

  const garbageKeywords = [
    'garbage', 'waste', 'trash', 'litter', 'pollution',
    'dumpster', 'bin', 'plastic bag', 'waste container'
  ];

  const waterKeywords = [
    'flood', 'flooding', 'water leak', 'leak', 'seepage',
    'sewage', 'pipe leak', 'burst pipe', 'puddle', 'rain water'
  ];

  const propertyDamageKeywords = [
    'crack', 'broken wall', 'broken house',
    'damaged wall', 'construction damage',
    'building damage', 'roof damage', 'structural damage'
  ];

  const environmentKeywords = [
    'forest', 'tree', 'wildfire', 'smoke',
    'pollution', 'fire', 'jungle', 'deforestation'
  ];

  // -----------------------------------
  // SCORING EACH CATEGORY
  // -----------------------------------

  const scores = {
    pothole: scoreCategory(labels, potholeKeywords),
    garbage: scoreCategory(labels, garbageKeywords),
    water: scoreCategory(labels, waterKeywords),
    propertyDamage: scoreCategory(labels, propertyDamageKeywords),
    environment: scoreCategory(labels, environmentKeywords)
  };

  console.log("📊 Category Scores:", scores);

  // Find highest scoring category
  const bestCategory = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  // If score is 0 → return "other"
  if (bestCategory[1] === 0) {
    return "other";
  }

  // Map to clean category names
  const categoryMap = {
    pothole: "pothole",
    garbage: "garbage",
    water: "water-leak",
    propertyDamage: "property-damage",
    environment: "environment"
  };

  return categoryMap[bestCategory[0]];
}

module.exports = autoCategorize;
