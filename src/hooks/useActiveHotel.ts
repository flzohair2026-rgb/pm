import { useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';

export function useActiveHotel() {
  const { activeHotelId, setActiveHotelId, hotels, isAdmin, role } = useAuthContext();
  useEffect(() => {}, [activeHotelId, hotels, isAdmin, role]);
  return { activeHotelId, setActiveHotelId, hotels, isAdmin, role };
}
