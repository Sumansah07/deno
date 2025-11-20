/**
 * Image Service - Provides real images from free sources
 * Integrates with Pexels, Unsplash, and other free image APIs
 */

export interface ImageSource {
  url: string;
  alt: string;
  width: number;
  height: number;
  source: 'pexels' | 'unsplash' | 'picsum' | 'placeholder';
}

/**
 * Curated high-quality images from Pexels (no API key required)
 */
const PEXELS_IMAGES = {
  // Business & Technology
  business: [
    'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  
  // Food & Restaurant
  food: [
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  
  // Fashion & Shopping
  fashion: [
    'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  
  // Travel & Lifestyle
  travel: [
    'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1591373/pexels-photo-1591373.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  
  // People & Portraits
  people: [
    'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=800'
  ],
  
  // Nature & Landscapes
  nature: [
    'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]
};

/**
 * Get a random image for a specific category
 */
export function getImageForCategory(category: keyof typeof PEXELS_IMAGES): ImageSource {
  const images = PEXELS_IMAGES[category];
  const randomImage = images[Math.floor(Math.random() * images.length)];
  
  return {
    url: randomImage,
    alt: `${category} image`,
    width: 800,
    height: 600,
    source: 'pexels'
  };
}

/**
 * Get multiple images for a category
 */
export function getImagesForCategory(category: keyof typeof PEXELS_IMAGES, count: number = 3): ImageSource[] {
  const images = PEXELS_IMAGES[category];
  const shuffled = [...images].sort(() => 0.5 - Math.random());
  
  return shuffled.slice(0, count).map(url => ({
    url,
    alt: `${category} image`,
    width: 800,
    height: 600,
    source: 'pexels' as const
  }));
}

/**
 * Get placeholder image from Picsum (Lorem Picsum)
 */
export function getPlaceholderImage(width: number = 800, height: number = 600, seed?: string): ImageSource {
  const seedParam = seed ? `?random=${seed}` : `?random=${Math.floor(Math.random() * 1000)}`;
  
  return {
    url: `https://picsum.photos/${width}/${height}${seedParam}`,
    alt: 'Placeholder image',
    width,
    height,
    source: 'picsum'
  };
}

/**
 * Smart image selection based on context keywords
 */
export function getContextualImage(context: string, width: number = 800, height: number = 600): ImageSource {
  const lowerContext = context.toLowerCase();
  
  // Business/Tech keywords
  if (lowerContext.includes('business') || lowerContext.includes('office') || lowerContext.includes('tech') || lowerContext.includes('startup')) {
    return getImageForCategory('business');
  }
  
  // Food keywords
  if (lowerContext.includes('food') || lowerContext.includes('restaurant') || lowerContext.includes('recipe') || lowerContext.includes('cooking')) {
    return getImageForCategory('food');
  }
  
  // Fashion keywords
  if (lowerContext.includes('fashion') || lowerContext.includes('clothing') || lowerContext.includes('shop') || lowerContext.includes('store')) {
    return getImageForCategory('fashion');
  }
  
  // Travel keywords
  if (lowerContext.includes('travel') || lowerContext.includes('vacation') || lowerContext.includes('hotel') || lowerContext.includes('destination')) {
    return getImageForCategory('travel');
  }
  
  // People keywords
  if (lowerContext.includes('team') || lowerContext.includes('people') || lowerContext.includes('profile') || lowerContext.includes('about')) {
    return getImageForCategory('people');
  }
  
  // Nature keywords
  if (lowerContext.includes('nature') || lowerContext.includes('outdoor') || lowerContext.includes('landscape') || lowerContext.includes('environment')) {
    return getImageForCategory('nature');
  }
  
  // Default to placeholder
  return getPlaceholderImage(width, height);
}

/**
 * Generate image HTML with proper attributes
 */
export function generateImageHTML(image: ImageSource, className?: string, lazy: boolean = true): string {
  const lazyAttr = lazy ? 'loading="lazy"' : '';
  const classAttr = className ? `class="${className}"` : '';
  
  return `<img src="${image.url}" alt="${image.alt}" width="${image.width}" height="${image.height}" ${classAttr} ${lazyAttr} />`;
}

/**
 * Image prompt additions for AI
 */
export const IMAGE_PROMPT_ADDITIONS = `
CRITICAL IMAGE INTEGRATION:
- NEVER use placeholder rectangles or empty image blocks
- ALWAYS use real images from the image service
- Use getContextualImage() to match images to content context
- For hero sections: Use high-quality landscape images (1200x600)
- For cards/thumbnails: Use square or portrait images (400x400 or 400x600)
- For profiles: Use people category images
- For products: Use relevant category images (food, fashion, etc.)

EXAMPLE USAGE:
Instead of: <div class="placeholder-image">Image placeholder</div>
Use: <img src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Business meeting" loading="lazy" />

RESPONSIVE IMAGES:
- Always include width and height attributes
- Use loading="lazy" for performance
- Add responsive CSS: max-width: 100%; height: auto;
`;