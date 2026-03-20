'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoGalleryProps {
  photos: string[];
  restaurantName: string;
}

export function PhotoGallery({ photos, restaurantName }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    startIndex: lightboxIndex ?? 0,
    direction: 'rtl',
  });

  const [currentSlide, setCurrentSlide] = useState(0);

  // Sync Embla's selected index to our state
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentSlide(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  // When lightbox opens, scroll to the clicked photo
  useEffect(() => {
    if (lightboxIndex !== null && emblaApi) {
      emblaApi.scrollTo(lightboxIndex, true);
    }
  }, [lightboxIndex, emblaApi]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    document.body.style.overflow = '';
  }, []);

  if (photos.length === 0) return null;

  return (
    <>
      {/* Horizontal photo strip */}
      <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide pb-2">
        {photos.map((url, index) => (
          <button
            key={index}
            onClick={() => openLightbox(index)}
            className="relative flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
          >
            <Image
              src={url}
              alt={`${restaurantName} - ${index + 1}`}
              fill
              className="object-cover"
              sizes="112px"
            />
          </button>
        ))}
      </div>

      {/* Lightbox with Embla Carousel for swipe support */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Photo counter */}
          <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm font-medium">
            {currentSlide + 1} / {photos.length}
          </div>

          {/* Navigation buttons */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  emblaApi?.scrollNext();
                }}
                className="absolute right-3 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  emblaApi?.scrollPrev();
                }}
                className="absolute left-3 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Embla Carousel */}
          <div
            className="w-full max-w-3xl max-h-[80vh] mx-4 overflow-hidden"
            ref={emblaRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-[80vh]">
              {photos.map((url, index) => (
                <div
                  key={index}
                  className="relative flex-[0_0_100%] min-w-0"
                >
                  <Image
                    src={url}
                    alt={`${restaurantName} - ${index + 1}`}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority={index === lightboxIndex}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Dot indicators */}
          {photos.length > 1 && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
              {photos.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    emblaApi?.scrollTo(index);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? 'bg-white w-6'
                      : 'bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Go to photo ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
