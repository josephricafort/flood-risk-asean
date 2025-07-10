
function camelCaseToLocation(str) {
  // Split the string at uppercase letters
  const words = str.match(/([A-Z][a-z]*)/g);
  if (!words || words.length < 2) return str; // fallback

  return `${words[0]} ${words[1]}`;
}

export {
    camelCaseToLocation
}