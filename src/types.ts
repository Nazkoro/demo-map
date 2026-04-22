export interface Place {
  id: string;
  lng: number;
  lat: number;
  name: string;
  price: number; // BYN, 0 = не указана
  categories: string[];
  dish: string;
  hours: string;
  address: string;
  note: string;
  imageUrls: string[];
  votesUp: number;
  votesDown: number;
  createdAt: number;
}

export interface PlaceFormData {
  name: string;
  price: number; // BYN, 0 = не указана
  categories: string[];
  dish: string;
  hours: string;
  address: string;
  note: string;
  images: File[];
}

export interface PlaceUpdateData {
  name: string;
  price: number; // BYN
  categories: string[];
  dish: string;
  hours: string;
  address: string;
  note: string;
  keepImageUrls: string[];
  newImages: File[];
}
