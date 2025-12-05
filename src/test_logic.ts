
const getStatDesc = (value: number, type: 'str' | 'agi' | 'vit' | 'int' | 'luk') => {
    if (type === 'luk') {
        if (value >= 640) return "[운명 조작]";
        if (value >= 320) return "[기적의 구현]";
        if (value >= 160) return "[인과 왜곡]";
        if (value >= 80) return "[로또 1등]";
        if (value >= 40) return "[주인공 보정]";
        if (value >= 20) return "[행운아]";
        if (value >= 0) return "[일반인]";
        if (value >= -20) return "[불운]";
        if (value >= -40) return "[마가 낌]";
        if (value >= -80) return "[저주받은 운명]";
        return "[데스티네이션]";
    }
    return "";
};

console.log("Testing Luck -50:");
console.log(getStatDesc(-50, 'luk'));

console.log("Testing Luck 0:");
console.log(getStatDesc(0, 'luk'));

console.log("Testing Luck -10:");
console.log(getStatDesc(-10, 'luk'));

console.log("Testing Luck -90:");
console.log(getStatDesc(-90, 'luk'));

console.log("Testing Luck null:");
console.log(getStatDesc(null as any, 'luk'));

