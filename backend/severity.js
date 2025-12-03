const vision = require("@google-cloud/vision");

// Google Vision client
const client = new vision.ImageAnnotatorClient({
  keyFilename: "serviceAccountKey.json",
});

// helper
function toLower(arr) {
  return arr.map((x) => x.toLowerCase());
}

function maxScoreFor(labels, words) {
  let max = 0;
  for (const l of labels) {
    if (words.includes(l.description.toLowerCase())) {
      max = Math.max(max, l.score);
    }
  }
  return max;
}

// MAIN FUNCTION
async function getSeverity(imageUrl, category) {
  const [result] = await client.labelDetection(imageUrl);
  const annotations = result.labelAnnotations;
  const labels = toLower(annotations.map((l) => l.description));

  console.log("🔥 Severity labels:", labels);

  // CATEGORY-WISE SEVERITY LOGIC
  if (category === "pothole") {
    const severeKeywords = ["sinkhole", "crater", "deep"];
    const moderateKeywords = ["pothole", "puddle", "road", "tar"];
    
    if (labels.some((l) => severeKeywords.includes(l))) return "severe";
    if (labels.some((l) => moderateKeywords.includes(l))) return "moderate";
    return "mild";
  }

  if (category === "garbage") {
    const severeScore = maxScoreFor(annotations, [
      "pollution",
      "dumpster",
      "waste container",
    ]);
    const moderateScore = maxScoreFor(annotations, [
      "garbage",
      "trash",
      "litter",
      "plastic bag",
    ]);

    if (severeScore > 0.70) return "severe";
    if (moderateScore > 0.50) return "moderate";
    return "mild";
  }

  if (category === "water-leak") {
    if (labels.includes("flood") || labels.includes("flooding")) return "severe";
    if (labels.includes("puddle") || labels.includes("rain")) return "moderate";
    return "mild";
  }

  if (category === "property-damage") {
    if (labels.includes("collapse") || labels.includes("damage")) return "severe";
    if (labels.includes("crack") || labels.includes("wall")) return "moderate";
    return "mild";
  }

  if (category === "environment") {
    if (labels.includes("wildfire") || labels.includes("fire")) return "severe";
    if (labels.includes("pollution") || labels.includes("smoke")) return "moderate";
    return "mild";
  }

  return "mild"; // default
}

module.exports = getSeverity;
