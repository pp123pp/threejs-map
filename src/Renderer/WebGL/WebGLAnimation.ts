function WebGLAnimation () {
    let context:any = null;
    let isAnimating = false;
    let animationLoop:any = null;
    let requestId:any = null;

    function onAnimationFrame (time:any, frame:any) {
        animationLoop(time, frame);

        requestId = context.requestAnimationFrame(onAnimationFrame);
    }

    return {

        start: function () {
            if (isAnimating === true) return;
            if (animationLoop === null) return;

            requestId = context.requestAnimationFrame(onAnimationFrame);

            isAnimating = true;
        },

        stop: function () {
            context.cancelAnimationFrame(requestId);

            isAnimating = false;
        },

        setAnimationLoop: function (callback:any) {
            animationLoop = callback;
        },

        setContext: function (value:any) {
            context = value;
        }

    };
}

export { WebGLAnimation };
