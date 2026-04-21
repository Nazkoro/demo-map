import { colorful } from '@versatiles/style';

/**
 * Светлая палитра в духе «Google Maps Light»: нейтральная суша, бледная зелень,
 * спокойная вода, жёлто-оранжевые магистрали — на тех же тайлах VersaTiles.
 */
const lightStyle = colorful({
  baseUrl: 'https://tiles.versatiles.org',
  colors: {
    land: '#f5f6f8',
    water: '#b3daf7',
    glacier: '#ffffff',
    wood: '#c9dcc4',
    grass: '#dce8d8',
    park: '#dce8d8',
    street: '#ffffff',
    streetbg: '#dadce0',
    motorway: '#fcc834',
    motorwaybg: '#f0a030',
    trunk: '#ffe082',
    trunkbg: '#f0a030',
    buildingbg: '#e8eaed',
    building: '#f1f3f4',
    boundary: '#9aa0a6',
    disputed: '#bdc1c6',
    residential: '#ebecef',
    commercial: '#ebecef',
    industrial: '#edf0f3',
    foot: '#f8f9fa',
    label: '#202124',
    labelHalo: '#ffffff',
    shield: '#ffffff',
    agriculture: '#e6efe3',
    rail: '#c8cdd2',
    subway: '#b0bcc6',
    cycle: '#f1f3f4',
    waste: '#ebece8',
    burial: '#e8e9e6',
    sand: '#f1f0ec',
    rock: '#eceff1',
    leisure: '#e3ebe0',
    wetland: '#d7e8dd',
    symbol: '#5f6368',
    danger: '#ea4335',
    prison: '#f8f9fa',
    parking: '#ebe8e6',
    construction: '#bdc1c6',
    education: '#fef7e0',
    hospital: '#fce8e6',
    poi: '#5f6368',
  },
});

export function getVersatilesLightStyle() {
  return lightStyle;
}
