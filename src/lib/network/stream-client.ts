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
                    } else if (json.type === 'data') {
                        console.log("[StreamClient] Received DATA payload (Length: " + JSON.stringify(json.content).length + ")");
                        callbacks.onComplete(json.content);
                    } else if (json.type === 'error') {
                        throw new Error(json.content);
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
