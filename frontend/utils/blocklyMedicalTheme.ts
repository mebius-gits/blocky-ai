import * as Blockly from 'blockly';

export const BLOCKLY_MEDICAL_PALETTE = {
    variable: { 
        primary: '#C1D8F5',
        secondary: '#9ABCE8',
        tertiary: '#709FD6',
    },
    logic: { 
        primary: '#C3DBC2',
        secondary: '#9FC49E',
        tertiary: '#79AB77',
    },
    math: { 
        primary: '#DCD1F4',
        secondary: '#C3B2E8',
        tertiary: '#A68FDB',
    },
    control: { 
        primary: '#FBE9D1',
        secondary: '#F5D2A5',
        tertiary: '#EEB875',
    },
    text: { 
        primary: '#F2D0E4',
        secondary: '#E8B1D0',
        tertiary: '#D68AB5',
    },
    workspaceBg: '#F2D0E4',
    accent: '#5c7c99',
    accentTeal: '#00796b',
    scrollbar: 'rgba(0, 0, 0, 0.12)',
    glow: 'rgba(92, 124, 153, 0.25)',
    glowTeal: 'rgba(0, 121, 107, 0.2)',
} as const;

const p = BLOCKLY_MEDICAL_PALETTE;

export const medicalTheme = Blockly.Theme.defineTheme('medical', {
    base: 'classic',
    blockStyles: {
        variable_blocks: {
            colourPrimary: p.variable.primary,
            colourSecondary: p.variable.secondary,
            colourTertiary: p.variable.tertiary,
        },
        logic_blocks: {
            colourPrimary: p.logic.primary,
            colourSecondary: p.logic.secondary,
            colourTertiary: p.logic.tertiary,
        },
        math_blocks: {
            colourPrimary: p.math.primary,
            colourSecondary: p.math.secondary,
            colourTertiary: p.math.tertiary,
        },
        control_blocks: {
            colourPrimary: p.control.primary,
            colourSecondary: p.control.secondary,
            colourTertiary: p.control.tertiary,
        },
        text_blocks: {
            colourPrimary: p.text.primary,
            colourSecondary: p.text.secondary,
            colourTertiary: p.text.tertiary,
        },
    },
    categoryStyles: {},
    componentStyles: {
        workspaceBackgroundColour: p.workspaceBg,
        toolboxBackgroundColour: '#ffffff',
        toolboxForegroundColour: '#263238',
        flyoutBackgroundColour: '#ffffff',
        flyoutForegroundColour: '#263238',
        flyoutOpacity: 0.95,
        scrollbarColour: p.scrollbar,
        insertionMarkerColour: p.accent,
        markerColour: p.accent,
        cursorColour: p.accentTeal,
        selectedGlowColour: p.glowTeal,
        replacementGlowColour: p.glow,
    },
    fontStyle: {
        family: "'Inter', 'Roboto', 'Segoe UI', system-ui, sans-serif",
        weight: '500',
        size: 13,
    },
    name: '',
});
