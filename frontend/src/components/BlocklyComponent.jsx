import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';

export default function BlocklyComponent({ onWorkspaceChange }) {
    const blocklyDiv = useRef(null);
    const workspaceRef = useRef(null);

    useEffect(() => {
        if (!blocklyDiv.current) return;

        // Inject Blockly with empty toolbox (no flyout)
        workspaceRef.current = Blockly.inject(blocklyDiv.current, {
            toolbox: null, // No toolbox - we generate blocks programmatically
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
                colour: '#ccc',
                snap: true
            }
        });

        if (onWorkspaceChange) {
            onWorkspaceChange(workspaceRef.current);
        }

        // Cleanup
        return () => {
            if (workspaceRef.current) {
                workspaceRef.current.dispose();
            }
        };
    }, []);

    return <div ref={blocklyDiv} style={{ width: '100%', height: '100%' }} />;
}
