export function removeIncompleteSentence(text:string) {
    // Define common ending punctuation marks for sentences
    const punctuation = ['.', '!', '?'];

    // Find the index of the last occurrence of a punctuation mark
    let lastIndex = -1;
    punctuation.forEach(mark => {
        const index = text.lastIndexOf(mark);
        if (index > lastIndex) {
            lastIndex = index;
        }
    });

    // If a punctuation mark is found, return the text after it
    if (lastIndex !== -1) {
        return text.substring(lastIndex + 1).trim();
    }
    
    // If no punctuation mark is found, return the original text
    return text.trim();
}
