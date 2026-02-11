import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';

import { medicalTheme } from '@/utils/blocklyMedicalTheme';

import styles from './BlocklyComponent.module.scss';

// 動態載入繁體中文語言包
if (typeof window !== 'undefined') {
    import('blockly/msg/zh-hant').then((zhHant) => {
        Blockly.setLocale(zhHant as unknown as { [key: string]: string });
    });
}

interface BlocklyComponentProps {
    onWorkspaceChange?: (workspace: Blockly.WorkspaceSvg) => void;
}

const BLOCKLY_TEXT_COLOR = '#18304E';
const SVG_TEXT_SELECTORS = [
    '.blocklyText',
    '.blocklyBlockText',
    '.blocklyEditableText',
    '.blocklyDropdownText',
    '.blocklyFlyoutLabelText',
    '.blocklyNonEditableField text',
    '.blocklyEditableField text',
    '.blocklyEditableField g text',
];

function applyBlocklyTextColor(root: HTMLElement) {
    const color = BLOCKLY_TEXT_COLOR;
    SVG_TEXT_SELECTORS.forEach((sel) => {
        root.querySelectorAll<SVGElement>(sel).forEach((el) => {
            el.setAttribute('fill', color);
            el.style.setProperty('fill', color, 'important');
        });
    });
}

export default function BlocklyComponent({ onWorkspaceChange }: BlocklyComponentProps) {
    const blocklyDiv = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

    useEffect(() => {
        if (!blocklyDiv.current) return;

        // Inject Blockly with empty toolbox (no flyout)
        workspaceRef.current = Blockly.inject(blocklyDiv.current, {
            toolbox: undefined,
            theme: medicalTheme,
            renderer: 'Zelos',
            scrollbars: true,
            trashcan: true,
            move: {
                scrollbars: true,
                drag: true,
                wheel: true
            },
            zoom: {
                controls: true,
                wheel: true,
                startScale: 0.8,
                maxScale: 2,
                minScale: 0.3,
                scaleSpeed: 1.2
            },
            grid: {
                spacing: 20,
                length: 3,
                colour: 'rgba(0, 0, 0, 0.08)',
                snap: true
            }
        });

        const root = blocklyDiv.current;

        // 直接設定 SVG 文字 fill（覆蓋 Zelos 白字），workspace 變更或延遲後重套以涵蓋非同步渲染
        const apply = () => {
            if (root.isConnected) applyBlocklyTextColor(root);
        };
        apply();
        const t1 = window.setTimeout(apply, 0);
        const t2 = window.setTimeout(apply, 150);
        const workspace = workspaceRef.current;
        const listener = () => requestAnimationFrame(apply);
        workspace?.addChangeListener(listener);

        if (onWorkspaceChange) {
            onWorkspaceChange(workspaceRef.current);
        }

        // Cleanup
        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            workspace?.removeChangeListener(listener);
            if (workspaceRef.current) {
                workspaceRef.current.dispose();
            }
        };
    }, [onWorkspaceChange]);

    return <div ref={blocklyDiv} className={styles.blocklyContainer} />;
}
