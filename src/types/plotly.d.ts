declare module 'plotly.js-dist-min' {
  export * from 'plotly.js';
  const Plotly: {
    newPlot: typeof import('plotly.js').newPlot;
    react: typeof import('plotly.js').react;
    relayout: typeof import('plotly.js').relayout;
    restyle: typeof import('plotly.js').restyle;
    redraw: typeof import('plotly.js').redraw;
    purge: typeof import('plotly.js').purge;
    update: typeof import('plotly.js').update;
    toImage: typeof import('plotly.js').toImage;
    downloadImage: typeof import('plotly.js').downloadImage;
    addTraces: typeof import('plotly.js').addTraces;
    deleteTraces: typeof import('plotly.js').deleteTraces;
    moveTraces: typeof import('plotly.js').moveTraces;
    extendTraces: typeof import('plotly.js').extendTraces;
    prependTraces: typeof import('plotly.js').prependTraces;
    register: typeof import('plotly.js').register;
    animate: typeof import('plotly.js').animate;
    validate: typeof import('plotly.js').validate;
    setPlotConfig: typeof import('plotly.js').setPlotConfig;
    addFrames: typeof import('plotly.js').addFrames;
    deleteFrames: typeof import('plotly.js').deleteFrames;
  };
  export default Plotly;
}

declare module 'plotly.js' {
  interface ToImgopts {
    bgcolor?: string;
  }
}
