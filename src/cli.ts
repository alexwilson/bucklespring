#!/usr/bin/env node
import { program } from 'commander'
import { getNotionPage, getNotionCollection } from './helper/notion-api'
import { pageChunkToMarkdown } from './helper/markdown'
import matter from 'vfile-matter'
import fs from 'fs'
import path from 'path'

type Data = {
    [key: string]: any
    matter: {
        [key: string]: string|string[]
    }
}
const patternedPathName = (pathName: string|undefined, fallback: string, data: {[key: string]: any} = {}) => {
    let newPathName = (pathName && pathName.length > 0) ? pathName : fallback

    const regex = /\[(?<name>\w+)\]/gi
    for (const pattern of pathName.matchAll(regex)) {
          if (pattern.groups.name in data) {
              const value = data[pattern.groups.name]
              newPathName = newPathName.replace(pattern[0], Array(value).join(','))
          }
    }
    return newPathName
}

const packageJson = require('../package.json')
 
program
  .version(packageJson.version)

const notion = program.command('notion')
notion
  .command('export-page <pageId>')
  .description('Convert a page to markdown')
  .option('-f, --filename <filename>', "File to write to, supports patterns.")
  .action(async function(pageId, options) {
      const page = await getNotionPage(pageId)
      const file = await pageChunkToMarkdown(page)
      matter(file)

      let metadata = {}
      if ('matter' in (file.data as Data)) {
          metadata = (file.data as Data).matter
      }
      const pathName = patternedPathName(options.filename, `${pageId}.md`, metadata)

      console.log(`Writing ${pathName} to disk!`)
      fs.writeFileSync(pathName, file.toString())
  })

notion
  .command('export-collection <collectionId> <collectionViewId>')
  .description('Convert a page to markdown')
  .option('-f, --filename <filename>', "Filename to use, supports patterns.")
  .option('-d, --dirname <dirname>', "Directory to write collection to")
  .action(async function(collectionId, collectionViewId, options) {
    if (options.dirname && !fs.existsSync(options.dirname)) {
        fs.mkdirSync(options.dirname)
    }

    const collection = await getNotionCollection(collectionId, collectionViewId)
    for (const pageId of collection) {
        const page = await getNotionPage(pageId)
        const file = await pageChunkToMarkdown(page)
        matter(file)

        const dirName = path.resolve(options.dirname ? options.dirname : './')

        let metadata = {}
        if ('matter' in (file.data as Data)) {
            metadata = (file.data as Data).matter
        }
        const pathName = path.resolve(dirName, patternedPathName(options.filename, `${pageId}.md`, metadata))

        console.log(`Writing ${pathName} to disk!`)
        fs.writeFileSync(pathName, file.toString())
    }
  }) 
program.parse(process.argv);
