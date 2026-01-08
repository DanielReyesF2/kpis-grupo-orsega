declare module 'react-image-gallery' {
  import { Component } from 'react';

  interface ImageGalleryItem {
    original: string;
    thumbnail?: string;
    originalHeight?: number;
    originalWidth?: number;
    loading?: 'lazy' | 'eager';
    thumbnailHeight?: number;
    thumbnailWidth?: number;
    thumbnailLoading?: 'lazy' | 'eager';
    fullscreen?: string;
    originalAlt?: string;
    thumbnailAlt?: string;
    originalTitle?: string;
    thumbnailTitle?: string;
    thumbnailLabel?: string;
    description?: string;
    srcSet?: string;
    sizes?: string;
    bulletClass?: string;
    renderItem?: (item: ImageGalleryItem) => React.ReactNode;
    renderThumbInner?: (item: ImageGalleryItem) => React.ReactNode;
  }

  interface ImageGalleryProps {
    items: ImageGalleryItem[];
    showNav?: boolean;
    autoPlay?: boolean;
    lazyLoad?: boolean;
    infinite?: boolean;
    showIndex?: boolean;
    showBullets?: boolean;
    showThumbnails?: boolean;
    showPlayButton?: boolean;
    showFullscreenButton?: boolean;
    disableThumbnailScroll?: boolean;
    disableKeyDown?: boolean;
    disableSwipe?: boolean;
    useBrowserFullscreen?: boolean;
    preventDefaultTouchmoveEvent?: boolean;
    onErrorImageURL?: string;
    indexSeparator?: string;
    thumbnailPosition?: 'top' | 'right' | 'bottom' | 'left';
    startIndex?: number;
    slideDuration?: number;
    slideInterval?: number;
    slideOnThumbnailOver?: boolean;
    swipeThreshold?: number;
    swipingTransitionDuration?: number;
    swipingThumbnailTransitionDuration?: number;
    onSlide?: (currentIndex: number) => void;
    onBeforeSlide?: (currentIndex: number) => void;
    onScreenChange?: (fullScreen: boolean) => void;
    onPause?: (currentIndex: number) => void;
    onPlay?: (currentIndex: number) => void;
    onClick?: (event: React.MouseEvent) => void;
    onImageLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
    onImageError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
    onTouchMove?: (event: React.TouchEvent) => void;
    onTouchEnd?: (event: React.TouchEvent) => void;
    onTouchStart?: (event: React.TouchEvent) => void;
    onMouseOver?: (event: React.MouseEvent) => void;
    onMouseLeave?: (event: React.MouseEvent) => void;
    onThumbnailError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
    onThumbnailClick?: (event: React.MouseEvent, index: number) => void;
    renderLeftNav?: (onClick: () => void, disabled: boolean) => React.ReactNode;
    renderRightNav?: (onClick: () => void, disabled: boolean) => React.ReactNode;
    renderPlayPauseButton?: (onClick: () => void, isPlaying: boolean) => React.ReactNode;
    renderFullscreenButton?: (onClick: () => void, isFullscreen: boolean) => React.ReactNode;
    renderCustomControls?: () => React.ReactNode;
    renderItem?: (item: ImageGalleryItem) => React.ReactNode;
    renderThumbInner?: (item: ImageGalleryItem) => React.ReactNode;
    additionalClass?: string;
    useTranslate3D?: boolean;
    isRTL?: boolean;
    flickThreshold?: number;
    stopPropagation?: boolean;
  }

  export default class ImageGallery extends Component<ImageGalleryProps> {
    play: () => void;
    pause: () => void;
    fullScreen: () => void;
    exitFullScreen: () => void;
    slideToIndex: (index: number) => void;
    getCurrentIndex: () => number;
  }
}
