# live2d-rename

`live2d-rename` command can change name and ID of Live2D avator directory and content to successfully read by FaceRig.

- Change directory name
- Change MODEL3.JSON file and all files refered by it (eg. PHYSICS3.JSON, texture directories)
- Change CFG file names and its IDs (ID must be matched with CFG file name)
- Change Icon file name
- Add graphical label to icon image file (`magick` command is required)

Tested on Cubism 3.2 format files + [FaceRig (Steam)](https://store.steampowered.com/app/274920/FaceRig/)

## Installation

```
npm install --global https://github.com/retorillo/live2d-rename.git
```

OR

```
git clone https://github.com/retorillo/live2d-rename.git
cd live2d-rename
npm link
```

## Usage

```
live2d-rename --src .\foo --dist .\bar
```

- `--src` (or `-s`, `--source`) [Mandatory] Specify source directory 
- `--dest` (or `-d`, `--destination`) [Mandatory] Specify destination directory (new name)
- `--force` (or `-f`) [Optional] Skip confirmation to remove destination directory during operation
- `--no-dupl` (or `-N`, `--no-duplication`) [Optional] Source directory will be removed after renamed (NOT RECOMMENDED BEFORE TEST)
- `--icon-label` (or `-i`) [Optional] Add label extracted (`[0-9a-z]$`) from new name specified by `--dest` option
  - eg. v110 will be extracted from girl-v110)
  - `magick` command is required
- `--install` (or `-I`) [Optional, Experimantal] Install destination content to FaceRig

## License

MIT

(C) 2019 Retorillo
