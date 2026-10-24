import type { BuildingId } from '../../types/domain'
export const buildings: Record<BuildingId, { title: string; hint: string; color: string; x: number; y: number }> = {
  bank: { title: 'Pine Bank', hint: 'Savings & debt', color: '#dcb87c', x: 18.5, y: 25 },
  office: { title: 'Town Office', hint: 'Income & career', color: '#aebcc0', x: 50.5, y: 18 },
  hospital: { title: 'Health House', hint: 'Hospital / Insurance', color: '#eee4b9', x: 82, y: 25 },
  home: { title: 'Your Home', hint: 'Rent & everyday costs', color: '#e1b17c', x: 33.5, y: 66 },
  market: { title: 'Market Hall', hint: 'Investments & allocation', color: '#d9b385', x: 69, y: 67 },
}
export const buildingIds = Object.keys(buildings) as BuildingId[]
