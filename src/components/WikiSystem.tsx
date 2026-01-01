import React, { useState } from 'react';
import { X, Search, BookOpen } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { getCharacterImage } from '@/lib/image-mapper';

interface WikiSystemProps {
    isOpen: boolean;
    onClose: () => void;
    initialCharacter?: string;
}

export default function WikiSystem({ isOpen, onClose, initialCharacter = "고하늘" }: WikiSystemProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentDoc, setCurrentDoc] = useState<string>(initialCharacter);



    // [Fix] Use stable selector to prevent infinite loops (getServerSnapshot error)
    const wikiData = useGameStore(state => state.wikiData);
    const gameWikiData = wikiData || {};
    const data = (gameWikiData as any)[currentDoc];

    // Debugging: Log loaded data keys
    React.useEffect(() => {
        console.log("WikiSystem mounted.");
        console.log("Loaded wiki data keys:", Object.keys(gameWikiData));
        console.log("Entries count:", Object.keys(gameWikiData).length);
        const categories = new Set(Object.values(gameWikiData).map((v: any) => v.category));
        console.log("Categories present:", Array.from(categories));
    }, [gameWikiData]);

    // Footnote Logic
    const footnotes: string[] = [];
    const [hoveredFootnote, setHoveredFootnote] = useState<{ id: number; content: string; x: number; y: number } | null>(null);

    // Grouping Logic for Sidebar
    const groupedData = React.useMemo(() => {
        const groups: Record<string, string[]> = {};
        Object.entries(gameWikiData).forEach(([key, value]: [string, any]) => {
            // Filter by search term
            if (searchTerm && !key.includes(searchTerm) && !value.name.includes(searchTerm)) return;

            // Simplified category name (remove 'AIChatBotGame/')
            const rawCategory = value.category || '기타';
            const category = rawCategory.replace('AIChatBotGame/', '');

            if (!groups[category]) groups[category] = [];
            groups[category].push(key);
        });
        return groups;
    }, [searchTerm, gameWikiData]);

    if (!isOpen) return null;

    // Unified parser for Inline Content (Links + Bold)
    const parseInline = (text: string) => {
        // First split by Links: [[Target]] or [[Target|Label]]
        const linkParts = text.split(/(\[\[.*?\]\])/g);
        return linkParts.map((part, i) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const inner = part.slice(2, -2);
                const [target, label] = inner.split('|');
                return (
                    <span
                        key={`link-${i}`}
                        className="text-[#00A495] font-bold cursor-pointer hover:underline"
                        onClick={() => setCurrentDoc(target)}
                    >
                        {label || target}
                    </span>
                );
            }

            // Then handle Bold: **Bold**
            return part.split(/(\*\*.*?\*\*)/g).map((subPart, j) => {
                if (subPart.startsWith('**') && subPart.endsWith('**')) {
                    return <span key={`bold-${i}-${j}`} className="font-bold text-black">{subPart.slice(2, -2)}</span>;
                }
                return subPart;
            });
        });
    };

    // Pre-process content to extract footnotes sequentially
    // usage: returns (string | JSX.Element)[] where string needs parseInline()
    const processFootnotes = (text: string) => {
        const parts: (string | React.ReactNode)[] = [];
        let lastIndex = 0;
        const regex = /<<(.*?)>>/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }
            footnotes.push(match[1]); // Content stored as raw string
            const footnoteIndex = footnotes.length;
            const footnoteContent = match[1];
            parts.push(
                <sup
                    key={`fn-${footnoteIndex}`}
                    id={`ref-${footnoteIndex}`}
                    className="text-[#00A495] cursor-pointer hover:underline font-bold ml-0.5 select-none"
                    onClick={() => {
                        document.getElementById(`fn-${footnoteIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredFootnote({
                            id: footnoteIndex,
                            content: footnoteContent,
                            x: rect.left,
                            y: rect.top
                        });
                    }}
                    onMouseLeave={() => setHoveredFootnote(null)}
                >
                    [{footnoteIndex}]
                </sup>
            );
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }
        return parts;
    };

    const renderText = (content: string) => {
        return content.split('\n').map((line, i) => {
            // 1. Process Footnotes First (Highest Priority Structure)
            const partsWithFootnotes = processFootnotes(line);

            // 2. Process Inline (Links, Bold) on string parts
            return (
                <p key={i} className="mb-2">
                    {partsWithFootnotes.map((part, j) => {
                        if (typeof part === 'string') {
                            return <React.Fragment key={j}>{parseInline(part)}</React.Fragment>;
                        }
                        return part; // Return footnote marker element directly
                    })}
                </p>
            );
        });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white w-full max-w-[1500px] h-[90vh] rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans text-gray-900 border border-gray-300"
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
                {/* Tooltip Popup */}
                {hoveredFootnote && (
                    <div
                        className="fixed z-[60] bg-white border border-gray-300 shadow-xl rounded p-3 text-sm max-w-xs pointer-events-none"
                        style={{
                            left: hoveredFootnote.x,
                            top: hoveredFootnote.y - 10,
                            transform: 'translateY(-100%)'
                        }}
                    >
                        <div className="font-bold text-[#00A495] mb-1">각주 [{hoveredFootnote.id}]</div>
                        <div className="text-gray-700">{parseInline(hoveredFootnote.content)}</div>
                    </div>
                )}

                {/* 1. Header */}
                <div className="bg-[#00A495] p-3 flex justify-between items-center shadow-md shrink-0 z-10">
                    <div className="flex items-center gap-2 text-white font-bold text-xl">
                        <BookOpen size={24} />
                        <span>NAMU WIKI</span>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mx-4 flex-1 max-w-md hidden md:block">
                        <input
                            type="text"
                            placeholder="여기에서 검색..."
                            className="w-full pl-10 pr-4 py-1.5 rounded-full bg-[#007F72] text-white placeholder-green-200 focus:outline-none focus:bg-[#006e63] transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1.5 text-green-200" size={18} />
                    </div>

                    <button onClick={onClose} className="text-white hover:bg-[#007F72] p-1 rounded transition-colors">
                        <X size={28} />
                    </button>
                </div>

                {/* 2. Body Container (Sidebar + Content) */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    {/* Sidebar Navigation */}
                    <div className="w-full md:w-64 bg-gray-50 border-r-0 md:border-r border-b md:border-b-0 border-gray-200 overflow-y-auto p-4 shrink-0 h-48 md:h-auto">
                        {Object.keys(groupedData).length === 0 ? (
                            <div className="text-gray-500 text-center text-sm py-4 flex flex-col gap-2">
                                <span>검색 결과 없음</span>
                                <span className="text-xs text-red-400">Total Entries: {Object.keys(gameWikiData).length}</span>
                                {Object.keys(gameWikiData).length === 0 && (
                                    <button
                                        onClick={() => {
                                            console.log("🔄 Force Reloading Wiki Data...");
                                            useGameStore.getState().setGameId('wuxia');
                                        }}
                                        className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded border border-red-200 hover:bg-red-200"
                                    >
                                        Force Reload Data
                                    </button>
                                )}
                            </div>
                        ) : (
                            Object.entries(groupedData).map(([category, items]) => (
                                <div key={category} className="mb-6">
                                    <h3 className="text-[#00A495] font-bold border-b border-[#00A495]/30 pb-1 mb-2 text-sm uppercase">
                                        {category}
                                    </h3>
                                    <ul className="space-y-1">
                                        {items.map((key) => (
                                            <li key={key}>
                                                <button
                                                    onClick={() => setCurrentDoc(key)}
                                                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors truncate ${currentDoc === key
                                                        ? 'bg-[#00A495] text-white font-bold shadow-sm'
                                                        : 'text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {key}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-auto bg-[#F0F0F0] relative">
                        <div className="min-h-full p-4 md:p-8 flex flex-col xl:flex-row gap-6">
                            {/* Article Content */}
                            <div className="flex-1 bg-white shadow-sm rounded-sm p-6 md:p-10 border border-gray-200">
                                {!data ? (
                                    <div className="text-center mt-20 text-gray-500">
                                        <h2 className="text-2xl font-bold mb-2">문서를 찾을 수 없습니다.</h2>
                                        <p>검색어: {currentDoc}</p>
                                        <button
                                            onClick={() => setCurrentDoc(initialCharacter)}
                                            className="mt-4 px-4 py-2 bg-[#00A495] text-white rounded hover:bg-[#008f82]"
                                        >
                                            메인으로 돌아가기
                                        </button>
                                    </div>
                                ) : (
                                    <div className="max-w-5xl mx-auto">
                                        {/* Title */}
                                        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-800 border-b-2 border-gray-300 pb-2 flex flex-wrap items-baseline gap-2">
                                            {data.name.split('(')[0]}
                                            <span className="text-lg font-normal text-gray-500">
                                                {data.name.match(/\((.*?)\)/)?.[0]}
                                            </span>
                                        </h1>

                                        <div className="flex flex-col-reverse xl:flex-row gap-8 mt-6">
                                            {/* Text Sections */}
                                            <div className="flex-1 space-y-8 min-w-0">
                                                {/* Category Label */}
                                                <div className="border border-[#00A495] rounded p-2 bg-green-50 text-sm text-[#00A495] inline-block mb-2">
                                                    분류: <span className="font-bold cursor-pointer hover:underline">{data.category || 'AIChatBotGame/분류 없음'}</span>
                                                </div>

                                                {data.sections.map((section: any, idx: number) => (
                                                    <div key={idx} className="group">
                                                        <h2 className="text-2xl font-bold text-gray-800 mb-3 border-b border-gray-200 pb-1 flex items-center">
                                                            <span className="bg-[#00A495] text-white text-sm px-2 py-0.5 rounded mr-2">{idx + 1}.</span>
                                                            {section.title}
                                                        </h2>
                                                        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                                                            {renderText(section.content)}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Footnotes Section */}
                                                {footnotes.length > 0 && (
                                                    <div className="mt-12 pt-4 border-t border-gray-300">
                                                        <h3 className="text-xl font-bold text-gray-800 mb-4">각주</h3>
                                                        <div className="text-sm text-gray-600 space-y-2">
                                                            {footnotes.map((note, i) => (
                                                                <div key={i} id={`fn-${i + 1}`} className="flex gap-2 group">
                                                                    <a
                                                                        href={`#ref-${i + 1}`}
                                                                        className="text-[#00A495] font-bold hover:underline select-none shrink-0"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            document.getElementById(`ref-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        }}
                                                                    >
                                                                        [{i + 1}]
                                                                    </a>
                                                                    <span>{parseInline(note)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* InfoBox */}
                                            <div className="w-full xl:w-[320px] shrink-0">
                                                <div className="border border-[#00A495] rounded overflow-hidden shadow-sm bg-white sticky top-4">
                                                    {/* Infobox Title */}
                                                    <div className="bg-[#00A495] text-white font-bold text-center py-2 text-lg">
                                                        {data.name.split(' ')[0]}
                                                    </div>

                                                    {/* Image */}
                                                    {data.image && getCharacterImage(data.image.split('_')[0], data.image.split('_')[1] || '기본') && (
                                                        <div className="bg-white p-4 flex justify-center border-b border-gray-200">
                                                            <img
                                                                src={getCharacterImage(data.image.split('_')[0], data.image.split('_')[1] || '기본')}
                                                                alt={data.name}
                                                                className="w-full h-auto rounded shadow-sm object-cover"
                                                                style={{ maxHeight: '400px' }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Attributes Table */}
                                                    <table className="w-full text-sm">
                                                        <tbody>
                                                            {data.infobox.map((item: any, idx: number) => (
                                                                <tr key={idx} className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors">
                                                                    <td className="bg-[#00A495]/10 text-[#00A495] font-bold p-3 w-[100px] text-center border-r border-gray-200 align-middle">
                                                                        {item.label}
                                                                    </td>
                                                                    <td className="p-3 text-gray-700 font-medium whitespace-pre-wrap">
                                                                        {item.value}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
