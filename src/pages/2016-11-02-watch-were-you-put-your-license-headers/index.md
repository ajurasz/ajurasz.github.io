---
title: "Watch were you put your license headers"
date: "2016-11-02"
tags: [docker]
---

Recently when I was playing with creating [Docker](https://www.docker.com/) images I came across really strange error during creation of a container that doesn't say much (not to me):

```bash
standard_init_linux.go:175: exec user process caused "exec format error"
```

<!-- end -->

after some time spent on searching information about it, I started to rollback all changes done to Dockerfile one by one until I found failing part. The issue was with a shell script which was starting with license header instead of [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix)) (i.e. `#!/bin/sh`).

From Unix perspective this script is valid (in terms that it executes and print's expected value on the screen):

```bash
 cat test.sh
#The MIT License (MIT)
#Copyright (c) 2016 Arek Jurasz
#
#Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without #limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following #conditions:
#
#The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
#
#THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO #EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR #THE USE OR OTHER DEALINGS IN THE SOFTWARE.

#!/usr/sh (1)

ps h -p $$ -o args='' | cut -f1 -d' ' (2)

echo "Success"
```

> (1) inform OS what interpreter should be used for this script

> (2) finds what interpreter is used to execute script

```bash

 ls -l
total 8
-rw-rw-r-- 1 arek arek   90 lis  2 10:55 Dockerfile
-rwxrwxr-x 1 arek arek 1117 lis  2 10:56 test.sh

 ./test.sh
/bin/sh
Success
```

if we change (1) to `#!/bin/bash` the output is still the same:

```bash
 ./test.sh
/bin/sh
Success
```

but we were expecting:

```bash
 ./test.sh
/bin/bash
Success
```

this is not happening because [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix)) is not in the first line and my OS is using default interpreter.


## Conclusion

[Docker](https://www.docker.com/) is more restrective if it comes to [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix)) and it will fail to run your container if one of the scripts doesn't starts with it. So be careful and don't make the same mistakes I did.
