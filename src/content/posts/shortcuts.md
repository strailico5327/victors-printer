---
title: "Shortcuts"
published: 2026-06-29
category: Tech
indev: true
tags:
    - Markdown
    - Shortcuts
---

:!## Markdown Shortcuts

These are the custom Markdown shortcuts currently available on Victor's Printer.

## Manual Title

Creates a heading with the normal Markdown heading style plus the primary accent bar.

```md
:!# My Section Title
```

The number of `#` characters maps to the standard Markdown heading level.

```md
:!# Heading 1
:!## Heading 2
:!### Heading 3
:!#### Heading 4
:!##### Heading 5
:!###### Heading 6
```

## Card Separator

Creates a visual card separator gap.

```md
:!===!:
```

## Inner Separator

Creates a light divider inside the current card without using a Markdown `<hr>`.

```md
:!==!:
```

## Date

Renders a right-aligned date. Use `DDMMYYYY`.

```md
:!date 09062026
```

## Link

Renders a link and stores whether the future preview frame should be enabled. The preview boolean is optional and defaults to `true`.

```md
:!link Victor's Toolkit https://toolkit.strailico.me/
```

Disable preview:

```md
:!link Plain Link https://example.com false
```

With paragraph formatting:

```md
:> :!link Indented Link https://example.com
```

Wrap another shortcut or block:

```md
:!link https://example.com true
:!img image.jpeg
!:link
```

## Paragraph Formatting

Force an indented paragraph.

```md
:> This paragraph is indented.
```

Force a right-aligned paragraph.

```md
:>> This paragraph is right-aligned.
```

Force no indentation in literary prose.

```md
:< This paragraph has no indentation.
```

## Single Image

Render one image. The default display width is `75%`.

```md
:!img image.jpeg
```

With a custom width:

```md
:!img image.jpeg 70%
```

Bare numeric widths become percentages:

```md
:!img image.jpeg 55
```

With a manual gallery name:

```md
:!img image.jpeg 65% @gallery-name
```

Legacy gallery-before-width order is also supported:

```md
:!img image.jpeg gallery-name 55
```

## Flex Image Row

Creates a flexible row of images. The optional first argument is the container width.

```md
:!flex 90%
:!img image-01.jpeg
:!img image-02.jpeg
:!img image-03.jpeg
!:flex
```

With a manual gallery:

```md
:!flex 85% @gallery-name
:!img image-01.jpeg
:!img image-02.jpeg
!:flex
```

## Fixed Grid

Creates a fixed image grid. The arguments are columns, rows, optional cell ratio, optional width, and optional gallery.

```md
:!grid 3 2 1/1 90%
:!img image-01.jpeg
:!img image-02.jpeg
:!img image-03.jpeg
:!img image-04.jpeg
:!img image-05.jpeg
:!img image-06.jpeg
!:grid
```

With a manual gallery:

```md
:!grid 2 2 16/9 85% @gallery-name
:!img image-01.jpeg
:!img image-02.jpeg
:!img image-03.jpeg
:!img image-04.jpeg
!:grid
```

## Mosaic

Creates a mosaic image block. The optional arguments are width, group ratio, and gallery.

```md
:!mosaic 90% 4/3
:!img image-01.jpeg
:!img image-02.jpeg
:/
:!img image-03.jpeg
:!img image-04.jpeg
!:mosaic
```

Use `:/ <ratio?>` to start a new mosaic row, optionally setting that row's cell ratio.

```md
:!mosaic 90%
:!img image-01.jpeg
:!img image-02.jpeg
:/ 16/9
:!img image-03.jpeg
:!img image-04.jpeg
!:mosaic
```

With a manual gallery:

```md
:!mosaic 90% 4/3 @gallery-name
:!img image-01.jpeg
:!img image-02.jpeg
!:mosaic
```
