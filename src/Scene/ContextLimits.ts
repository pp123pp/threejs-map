const ContextLimits = {
    _maxAnisotropy: 0,

    get maxAnisotropy (): number {
        return ContextLimits._maxAnisotropy;
    },

    _maximumTextureImageUnits: 0,

    get maximumTextureImageUnits (): number {
        return ContextLimits._maximumTextureImageUnits;
    }
};

export { ContextLimits };
