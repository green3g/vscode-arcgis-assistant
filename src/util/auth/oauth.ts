
import * as express from 'express';
import * as passport from 'passport';
import {Strategy as ArcGISStrategy} from 'passport-arcgis';
import * as vscode from 'vscode';

const PORT = 3000;
const APPID = 'JYBrPM46vyNVTozY';
const SECRET = '7820dfc5c3254f2b91a095db827a3556';
const WORKSPACE = 'portal.authorizations';

function updateTokenContext(context : vscode.ExtensionContext, authorizations : any){
    context.workspaceState.update(WORKSPACE, authorizations);
}

passport.serializeUser(function(user, done) {
    done(null, user);
  });
  
  passport.deserializeUser(function(obj, done) {
    done(null, obj);
  });
    
export default function getAuthToken(context: vscode.ExtensionContext, portalUrl : string = 'www.arcgis.com') : Promise<any>{

    const authorizations : any = context.workspaceState.get(WORKSPACE) || {};

    if(authorizations[portalUrl] && authorizations[portalUrl].accessToken) {
        const profile = authorizations[portalUrl].profile;
        return Promise.resolve({token: authorizations[portalUrl].accessToken, profile});
    }

    if(authorizations[portalUrl] && authorizations[portalUrl].refreshToken){
        // NOT IMPLEMENTED
    }
    let server : any;

    return new Promise(resolve => {
        const app = express();

        passport.use(new ArcGISStrategy({
            clientID: APPID,
            clientSecret: SECRET,
            callbackURL: `http://lvh.me:${PORT}/callback`,
            authorizationURL: `https://${portalUrl}/sharing/oauth2/authorize`,
            tokenURL: `https://${portalUrl}/sharing/oauth2/token`
        },
        function(accessToken : string, refreshToken : string, profile : any, done : Function) {

            authorizations[portalUrl] = {
                accessToken,
                refreshToken,
                profile,
            };
            updateTokenContext(context, authorizations);
            resolve({
                token: accessToken,
                profile,
            });
            return done(null, profile);
        }
        ));
        app.use(passport.initialize());
        app.use('/authenticate', passport.authenticate('arcgis'));
        app.use('/callback', passport.authenticate('arcgis'), function(result, response){
            if(result.query.code){
                setTimeout(() => {
                    console.log('Shutting down server...');
                    server.close();
                }, 5000);
                response.send('Login successful! You may now close this page<br /><a onclick="javascript:window.close();">Close</a>');
            } else {
                response.send('Error! No login code was passed');
            }
        });
        server = app.listen(PORT, () => {
            console.log(`Token app listening on port ${PORT}!`);
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`http://lvh.me:${PORT}/authenticate`));
        });

            
    });

}