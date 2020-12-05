# arcgis-assistant README

Brings ArcGIS Online/Portal JSON items into VSCode and back!

![img](./docs/img/ago-assistant.gif)

## Current Features

 - Connect and browse multiple Portal/AGO accounts in a folder hierarchy using a tree view built into VS Code.
 - Edit JSON data from items directly in VS Code using a pretty JSON format.
 - Save JSON items back to Portal/AGO in a compact JSON format after JSON format validation.
 - Delete items.
 - Copy/Paste items between folders and AGO/Portal accounts

## Future enhancements/bugs:

See [issues/enhancements](https://github.com/roemhildtg/vscode-arcgis-assistant/issues)

Please upvote important issues using the :thumbsup: button. 

## Requirements

1. VS Code
2. Open workspace with read/write permissions

In order to perform editing, VSCode will download a copy of the ArcGIS Item JSON to a local in-memory directory.

## Download

See the [Releases Page](https://github.com/roemhildtg/vscode-arcgis-assistant/releases) for downloads.

## Installing and Usage

When you download the vsix file from the releases page, it can be installed by using the Extensions toolbar. See [Installing vsix files](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix)

Now when you open up vscode, you should see an ArcGIS pane in the explorer tab. (It will be towards the bottom). Hovering over this, will allow you to add a portal. You can also use the command `addPortal`. This will
add the portal to the tree. You will be prompted to log in once you access the tree data, if your url is correct.

Editing items can be done by clicking the item. If you double click it again, after its been opened, VSCode will automatically format the `json` document.

After saving, the extension will automatically prompt you to upload the modified item. 

If you are using AGO, you can skip the App ID prompt (hit enter). 

**Portal Usage:**

1. Log in to your portal and add a new application
2. Go to the application settings page and register the URL for the VSCode assistant plugin (http://lvh.me:3000)
3. Copy the applicationID from the settings page and paste it into the VSCode prompt

You only have to do this once per portal, and the plugin will cache the app ID between sessions. 

## Developing

This projet uses vs code for development and must be installed prior to starting. 

```
git clone <this repo>
npm i

```

Run the VSC debugger tool.

## Building for production

Due to a bug in `copy-paste` before building to production, `copy-paste/index.js` must be modified to

```javascript
	case "openbsd":
        config = require("./platform/linux");
```

See [Pull Request here](https://github.com/xavi-/node-copy-paste/pull/67)

## Troubleshooting

While this extension is considered "stable" and has been tested with various Portal and AGO implementations, issues may arise under various circumstances. Please report issues under the [Issues](https://github.com/roemhildtg/vscode-arcgis-assistant/issues) page providing as much information as possible in order to reproduce the issue. 

Check the OUTPUT -> ArcGIS Assistant console logs as well for potentially useful feedback. 

If you are interested in fixing the issue download the source code and use the built-in VSCode debugger tools to diagnose the issue. Follow the Developing guide above.

## License

Please review the [software license](./LICENSE.md) prior to use.
