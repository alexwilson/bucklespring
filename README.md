# Bucklespring
A library & command-line utility for converting Notion documents into Markdown (Mdast).

Bucklespring is built on Remark & Unified and so is fully compatible with all tools & plugins in the Remark ecosystem.

## Use-cases
- Transforming Notion content into other formats (e.g. HTML with Rehype)
- Building proofing tools for Notion content (e.g. AlexJS).
- Exporting content (e.g. blog posts) into files for static-site generators (e.g. Github Pages).

## Examples

### JavaScript Library
More examples can be found in [`./examples/`](./examples)

```javascript
const { notionToMdast } = require('bucklespring')
const { getNotionPage } = require('bucklespring/helper/notion-api')

const notionPage = JSON.stringify(await getNotionPage("d08e52c1-1f05-4c27-85bc-e215261fa4dd"))
const tree = await unified()
    .use(notionToMdast)
    .use(serializeMarkdown)
    .use(frontMatter)
    .process(notionPage)
console.log(tree.toString())
}
```

### Command-Line
```bash
# Export a page
npx bucklespring notion export-page d08e52c1-1f05-4c27-85bc-e215261fa4dd

# Export a page using its frontmatter as a filename.
npx bucklespring notion export-collection --filename "[title].md" d08e52c1-1f05-4c27-85bc-e215261fa4dd

# Export a collection with a collection-view
npx bucklespring notion export-collection 53511a6a-726e-47db-82cc-dac166f31466 91d6a116-7f4f-44d3-ba10-6f96267da034

# Export a collection using their frontmatter for filenames
npx bucklespring notion export-collection --dirname test --filename "[id].md" 53511a6a-726e-47db-82cc-dac166f31466 91d6a116-7f4f-44d3-ba10-6f96267da034
```

## FAQ

### Why not publish a major release?
Simply put: Until Notion's full API rollout, a major version seems irresponsible as the unofficial API may change.
However!  0.x.x versions are as stable as any other unofficial API client.

### This seems like an awful lot of trouble to go to for a blog/[insert use-case here]!
I agree!
Reading an abstract-syntax-tree (AST) is an important first-step in being able to render something from a CMS.
Both more traditional CMSes and block-based CMSes use a process such as this one for rendering.

With this library, you can render into HTML (via Rehype) or plug-and-play with any other Unified-compatible format.

## Contributing

### Kitchen Sink
An important concept in `bucklespring` is the Kitchen Sink, which is used as a Mock.
This is a real page on Notion which includes many different inline block components.
Its purpose is to validate that all of the `converters` are doing their jobs correctly.

Currently there is only one kitchen sink - although this is tested against other 

### Mocks
The easiest way to develop `bucklespring` is using the Kitchen Sink boilerplate.
