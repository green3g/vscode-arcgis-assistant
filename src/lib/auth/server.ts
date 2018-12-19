
import * as express from 'express';
import * as passport from 'passport';
import {Strategy as ArcGISStrategy} from 'passport-arcgis';

const PORT = 3000;
const APPID = 'JYBrPM46vyNVTozY';
const SECRET = '7820dfc5c3254f2b91a095db827a3556';

export interface PortalAuthOptions {
    clientID: string;
    clientSecret: string;
    portalURL: string;
    callbackURL?: string;
    authorizationURL?: string;
    tokenURL?: string;
}


passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});


/**
 * @param auth Authentication properties for passport
 * @param tokenResolver Function to call when the token is resolved
 */
export default function startServer(url: string, tokenResolver : Function){
    let server : any;
    const app = express();

    const passportOptions = {
        clientID: APPID,
        clientSecret: SECRET,
        callbackURL: `http://lvh.me:${PORT}/callback`,
        authorizationURL: `https://${url}/sharing/oauth2/authorize`,
        tokenURL: `https://${url}/sharing/oauth2/token`
    };

    passport.use(new ArcGISStrategy(passportOptions,
    function(accessToken : string, refreshToken : string, profile : any, done : Function) {
        tokenResolver({
            accessToken,
            refreshToken,
            profile,
        });
        return done(null, profile);
    }
    ));
    app.use(passport.initialize());
    app.use('/authenticate', passport.authenticate('arcgis'));
    app.use('/callback', passport.authenticate('arcgis'), function(result, response){
        if(result.query.code){
            response.send('Login successful! You may now close this page<br /><a onclick="javascript:window.close();">Close</a>');
        } else {
            response.send('Error! No login code was passed');
        }
    });
    server = app.listen(PORT, () => {
        console.log(`Token app listening on port ${PORT}!`);
    });

    return server;
}