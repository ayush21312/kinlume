// A small, explicit vocabulary helps with common typos without guessing place names.
// Suggestions stay on this device and are applied only when the user chooses them.
const corrections = {
  foood: "food",
  fod: "food",
  pnatry: "pantry",
  pnatries: "pantries",
  panrty: "pantry",
  pantrys: "pantries",
  clothng: "clothing",
  cloting: "clothing",
  hygeine: "hygiene",
  hygene: "hygiene",
  progrmas: "programs",
  porgrams: "programs",
  assitance: "assistance",
  resoruces: "resources",
  resouces: "resources",
  opporutnities: "opportunities",
  volunter: "volunteer",
  employement: "employment",
};

export function suggestSearchQuery(query) {
  const corrected = query.replace(
    /\b[a-z]+\b/gi,
    (word) => corrections[word.toLowerCase()] || word,
  );
  return corrected === query ? "" : corrected;
}
