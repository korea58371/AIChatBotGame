export async function fetchAgentTurnStream(
    params: {
        history: any[];
        userInput: string;
        gameState: any;
        language: string | null;
        modelName?: string;
    },
    callbacks: {
        onToken: (text: string) => void;
        onComplete: (data: any) => void;
        onError: (err: any) => void;
        onProgress?: (stage: string, duration: number) => void;
    }
) {
    try {
        const response = await fetch('/api/game/turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            throw new Error(`Stream Error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response body is not readable");

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            buffer += text;

            const lines = buffer.split('\n');
            // Keep the last part in buffer (it might be incomplete)
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);

                    if (json.type === 'text') {
                        callbacks.onToken(json.content);
                    } else if (json.type === 'progress') {
                        // [Pipeline Progress] Real-time stage completion logging
                        const stageEmoji: Record<string, string> = { casting: '🎭', retriever: '📚', preLogic: '🧠', director: '🎬', story: '📝', postLogic: '⚙️' };
                        const emoji = stageEmoji[json.stage] || '▶';
                        console.log(
                            `%c[Pipeline] ${emoji} ${json.stage} %c${json.duration}ms`,
                            'color: #4FC3F7; font-weight: bold',
                            'color: #FFD54F; font-weight: bold'
                        );
                        if (json.input) console.log(`  ↳ input:`, json.input);
                        if (json.output) console.log(`  ↳ output:`, json.output);
                        // [NEW] Forward to UI
                        callbacks.onProgress?.(json.stage, json.duration);
                    } else if (json.type === 'data') {
                        console.log("[StreamClient] Received DATA payload (Length: " + JSON.stringify(json.content).length + ")");
                        callbacks.onComplete(json.content);
                    } else if (json.type === 'error') {
                        // [Fix] Propagate server errors via onError callback instead of throwing
                        // inside try-catch, which was silently swallowing the error as a parse warning.
                        console.error("[StreamClient] Server Error Received:", json.content);
                        callbacks.onError(new Error(json.content));
                        return; // Stop processing this stream
                    }
                } catch (e) {
                    console.warn("[StreamClient] Failed to parse line:", line, e);
                }
            }
        }

        // Process any remaining buffer (if flushing)
        if (buffer.trim()) {
            try {
                const json = JSON.parse(buffer);
                if (json.type === 'data') {
                    console.log("[StreamClient] Flushed final data from buffer");
                    callbacks.onComplete(json.content);
                }
            } catch (err) {
                console.warn("[StreamClient] Failed to flush final buffer:", buffer, err);
            }
        }

        console.log("[StreamClient] Stream Closed.");

    } catch (e) {
        callbacks.onError(e);
    }
}
