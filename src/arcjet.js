import arcjet, { shield,detectBot, slidingWindow } from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE == 'DRY_RUN' ? 'DRY_RUN' : "LIVE";

if(!arcjetKey) throw new Error("Arcjet Key Environment variable Not Found.");


  export const httpArcjet = arcjetKey ?
   arcjet({
    key: arcjetKey,
    characteristics: ["ip.src"],
    rules:[
        shield({mode: arcjetMode}),
       detectBot({ mode: arcjetMode, allow: ["CATEGORY:SEARCH_ENGINE" , "CATEGORY:PREVIEW"]}),
        slidingWindow({ mode: arcjetMode, interval:"100s", max:50 })
    ] ,

    }) : null;



  export const wsArcjet = arcjetKey ?
    arcjet({
          key: arcjetKey,
        rules:[
        shield({mode: arcjetMode}),
        detectBot({ mode: arcjetMode, allow: ["CATEGORY:SEARCH_ENGINE" , "CATEGORY:PREVIEW"]}),
        slidingWindow({ mode: arcjetMode, interval:"2s", max:5 }),
    ] ,

   }) : null;


   export function securityMiddleware(){
    return async (req, res, next) => {
        if(!httpArcjet) return next();
         
        try{
         const decision = await httpArcjet.protect(req);  /* takes the decision wheather to block a request or let it pass through accorfing to the arcjet rules set*/
  
         if(decision.isDenied()){
            if(decision.reason.isRateLimit()){
                return res.status(429).json( {error: "Too Many Requests"});
            }

            return res.status(403).json({error: "Error"} );
         }
        } catch(e){
            console.error("Arcjet MiddlewareError", e);
            return res.status(503).json({error:'service Unavailable'});
        }

        next();
        }
   }
 
