const TOTAL_IMAGES = 6;
const STORAGE_KEY = "last_loading_image_index";

const FILES = [
  "/loading/loading1.webp",
  "/loading/loading2.jpg",
  "/loading/loading3.jpg",
  "/loading/loading4.jpg",
  "/loading/loading5.jpg",
  "/loading/loading6.jpg",
];

export function getNextLoadingImage(): string {
  const lastIndex = parseInt(localStorage.getItem(STORAGE_KEY) || "-1", 10);

  if (FILES.length <= 1) return FILES[0];

  let newIndex;

  do {
    newIndex = Math.floor(Math.random() * FILES.length);
  } while (newIndex === lastIndex);

  localStorage.setItem(STORAGE_KEY, newIndex.toString());

  return FILES[newIndex];
}