import './index.css'
import '@logseq/libs'
import { render } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import {
  Books,
  Faders,
  FileAudio,
  Folder,
  Images,
  ListMagnifyingGlass,
  Prohibit,
} from '@phosphor-icons/react'
import { MoonLoader } from 'react-spinners'
import { LSPluginBaseInfo } from '@logseq/libs/dist/LSPlugin'

const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const bookFormats = ['pdf']
const videoFormats = ['mp4']
const audioFormats = ['mp3']

const tabTypes = {
  'books': bookFormats,
  'audios': audioFormats,
  'images': imageFormats
}

const makeMdAssetLink = ({
  name, path, extname
}) => {
  if (!name || !path) return
  path = path.split('/assets/')?.[1]
  if (!path) return

  const isSupportedRichExt = [...imageFormats, ...bookFormats, ...audioFormats, ...videoFormats]
    .includes(extname?.toLowerCase())

  return `${isSupportedRichExt ? '!' : ''}[${name}](assets/${path})`
}

function App() {
  const elRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [data, setData] = useState([])
  const [currentListData, setCurrentListData] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const tabs = ['all', 'books', 'images', 'audios']
  const [activeTab, setActiveTab] = useState(tabs[0])
  // const [asFullFeatures, setAsFullFeatures] = useState(false)

  // normalize item data
  const normalizeDataItem = (it) => {
    it.name = it.path && it.path.substring(it.path.lastIndexOf('/') + 1)

    if (typeof it.name === 'string') {
      it.originalName = it.name
      it.name = it.name.replace(/[0-9_]{5,}(\.|$)/g, '$1')
      const extDotLastIdx = it.name.lastIndexOf('.')
      if (extDotLastIdx !== -1) {
        it.extname = it.name.substring(extDotLastIdx + 1)
      }
    }
    if (typeof it.size === 'number') {
      it.size = (it.size / 1024).toFixed(2)
      if (it.size > 999) {
        it.size = (it.size / 1024).toFixed(2)
        it.size += 'MB'
      } else {
        it.size += 'KB'
      }
    }
    return it
  }

  // is full features pane
  const isAsFullFeatures = () => document.body.classList.contains('as-full')

  const closeUI = (opts: any = {}) => {
    logseq.hideMainUI(opts)
    setVisible(false)
    setActiveTab('all')
    document.body.classList.remove('as-full')
  }

  const resetActiveIdx = () => setActiveIdx(0)
  const upActiveIdx = () => {
    if (!currentListData?.length) return
    let toIdx = activeIdx - 1
    if (toIdx < 0) toIdx = currentListData?.length - 1
    setActiveIdx(toIdx)
  }

  const downActiveIdx = () => {
    if (!currentListData?.length) return
    let toIdx = activeIdx + 1
    if (toIdx >= currentListData?.length) toIdx = 0
    setActiveIdx(toIdx)
  }

  // load all assets data
  const doPrepareData = async () => {
    if (preparing) return
    setPreparing(true)
    const data = await logseq.Assets.listFilesOfCurrentGraph()
    await new Promise(r => setTimeout(r, 100))
    setData(data?.map(normalizeDataItem))
    setPreparing(false)
  }

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target && el.contains(target)) return
      closeUI()
    }

    const handleKeyup = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inputValue !== '') {
          return setInputValue('')
        }

        closeUI({ restoreEditingCursor: true })
        return
      }

      if (e.ctrlKey && e.key === 'Tab') {
        const activeTabIdx = tabs.findIndex((v) => v === activeTab)
        let toIdx = activeTabIdx + 1
        // move tab
        if (toIdx >= tabs.length) toIdx = 0
        if (toIdx < 0) toIdx = (tabs.length - 1)
        setActiveTab(tabs[toIdx])
      }
    }

    document.addEventListener('keyup', handleKeyup, false)
    document.addEventListener('click', handleClick, false)

    return () => {
      document.removeEventListener('keyup', handleKeyup)
      document.removeEventListener('click', handleClick)
    }
  }, [inputValue, activeTab])

  useEffect(() => {
    logseq.on('ui:visible:changed', ({ visible }) => {
      if (visible) setVisible(true)
    })

    setVisible(true)
    doPrepareData().catch(console.error)
  }, [])

  // search
  useEffect(() => {
    resetActiveIdx()

    const typedData = data.filter(it => {
      const activeTypes = tabTypes[activeTab]

      if (activeTypes && !activeTypes.includes(it.extname?.toLowerCase())) {
        return
      }

      return true
    })

    if (!inputValue?.trim()) {
      setCurrentListData(typedData?.slice(0, 8))
      return
    }

    // Unicode / universal (50%-75% slower)
    const fuzzy = new window.uFuzzy({
      unicode: true,
      interSplit: '[^\\p{L}\\d\']+',
      intraSplit: '\\p{Ll}\\p{Lu}',
      intraBound: '\\p{L}\\d|\\d\\p{L}|\\p{Ll}\\p{Lu}',
      intraChars: '[\\p{L}\\d\']',
      intraContr: '\'\\p{L}{1,2}\\b',
    })
    const result = fuzzy.search(typedData.map(it => it.name), inputValue)

    if (!result?.[1]) return
    const { idx, ranges } = result[1]
    setCurrentListData(idx?.map((idx, n) => {
      const r = typedData[idx]
      r.ranges = ranges[n]
      return r
    })?.slice(0, 8))
  }, [data, inputValue, activeTab])

  const onSelect = (activeItem: any) => {
    if (!activeItem) return
    const asFullFeatures = isAsFullFeatures()

    if (asFullFeatures) {
      logseq.App.openExternal('file://' + activeItem.path)
      return
    }

    closeUI()
    setInputValue('')

    logseq.Editor.insertAtEditingCursor(
      makeMdAssetLink(activeItem)
    )
  }

  return (
    <div className={'search-input-container animate__animated' + (visible ? ' animate__defaultIn' : '')} ref={elRef}>
      <div className="search-input-head">
        <span className={'icon-wrap'}>
          <ListMagnifyingGlass size={28} weight={'duotone'}/>
        </span>
        <span className={'input-wrap'}>
          <input placeholder={'Search assets'}
                 value={inputValue}
                 onKeyDown={(e) => {
                   const key = e.code
                   const isCtrlKey = e.ctrlKey
                   const isArrowUp = key === 'ArrowUp' || (isCtrlKey && key === 'KeyP')
                   const isArrowDown = key === 'ArrowDown' || (isCtrlKey && key === 'KeyN')
                   if (isArrowDown || isArrowUp) {
                     isArrowDown ?
                       downActiveIdx() :
                       upActiveIdx()

                     e.stopPropagation()
                     e.preventDefault()
                   }
                 }}

                 onKeyUp={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault()
                     const activeItem = currentListData?.[activeIdx]
                     onSelect(activeItem)
                     return
                   }
                 }}
                 onChange={e => {
                   setInputValue(e.target.value)
                 }}
          />
        </span>
      </div>

      {/* tabs */}
      <ul className="search-input-tabs">
        <li className={activeTab === 'all' && 'active'} tabIndex={0}
            onClick={() => setActiveTab('all')}>
          <strong>All</strong>
          <code>{data?.length || 0}</code>
        </li>

        <li className={activeTab === 'books' && 'active'} tabIndex={0}
            onClick={() => setActiveTab('books')}>
          <Books size={18} weight={'duotone'}/>
          <strong>Books</strong>
        </li>

        <li className={activeTab === 'images' && 'active'} tabIndex={0}
            onClick={() => setActiveTab('images')}>
          <Images size={18} weight={'duotone'}/>
          <strong>Images</strong>
        </li>

        <li className={activeTab === 'audios' && 'active'} tabIndex={0}
            onClick={() => setActiveTab('audios')}>
          <FileAudio size={18} weight={'duotone'}/>
          <strong>Audios</strong>
        </li>

        <li className={'more'}>
          <span onClick={() => logseq.UI.showMsg('TODO:// settings')}>
            <Faders size={18} weight={'bold'}/>
          </span>
        </li>
      </ul>

      {/* items */}
      <ul className={'search-input-list'}>
        {preparing ?
          <li className={'loading'}>
            <MoonLoader size={18}/>
          </li> :
          (!currentListData?.length ?
            <li className={'nothing'}>
              <Prohibit size={16}/> No results
            </li> :
            (currentListData?.map((it, idx) => {
              let name = it.name

              if (it.ranges?.length && inputValue?.length) {
                const ranges = it.ranges.map((range, n) => {
                  if (n === 0) return name.substring(0, range)
                  const ret = name.substring(it.ranges[n - 1], range)
                  return n % 2 === 0 ? ret : `<marker>${ret}</marker>`
                })

                const lastIdx = it.ranges[it.ranges.length - 1]

                if (lastIdx < name.length) {
                  ranges.push(name.substring(lastIdx))
                }

                name = ranges.join('')
              }

              return (
                <li key={it.path}
                    className={idx === activeIdx && 'active'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(it)
                    }}
                >
                  <div className="l">{it.extname?.toUpperCase()}</div>
                  <div className="r">
                    <strong
                      title={it.originalName}
                      dangerouslySetInnerHTML={{ __html: name }}></strong>
                    <p>
                      {it.size} • Modified 2023/09/01 12:34
                    </p>

                    <span className="ctrls">
                      <a onClick={(e) => {
                        logseq.App.showItemInFolder(it.path)
                        e.stopPropagation()
                      }}>
                        <Folder size={18} weight={'duotone'}/>
                      </a>
                    </span>
                  </div>
                </li>
              )
            })))}
      </ul>
    </div>
  )
}

let mounted = false

function mount() {
  if (mounted) return

  render(<App/>, document.getElementById('app'))
  mounted = true
}

async function showPicker() {
  const container = document.querySelector('.search-input-container') as HTMLDivElement
  const {
    left,
    top,
    rect,
  } = (await logseq.Editor.getEditingCursorPosition() || {
    left: 0, top: 0, rect: null
  })

  const cls = document.body.classList
  cls.remove('as-full')
  if (!rect) {cls.add('as-full')}

  Object.assign(container.style, rect ? {
    top: top + rect.top + 'px',
    left: left + rect.left + 4 + 'px',
    transform: 'unset'
  } : {
    left: '50%',
    top: '15%',
    transform: 'translate3d(-50%, 0, 0)'
  })

  logseq.showMainUI()

  // focus input
  setTimeout(() => {
    container.querySelector('input')?.select()
  }, 100)
}

function main(baseInfo: LSPluginBaseInfo) {
  const open: any = () => {
    mount()
    return setTimeout(showPicker, 0)
  }

  logseq.Editor.registerSlashCommand('Insert a local asset file', open)
  logseq.App.registerCommandPalette({
    key: 'logseq-assets-plus',
    label: 'Assets Plus: open picker',
    keybinding: { binding: 'meta+shift+o' }
  }, open)

  // themes
  const loadThemeVars = async () => {
    const props = [
      '--ls-primary-background-color',
      '--ls-secondary-background-color',
      '--ls-tertiary-background-color',
      '--ls-quaternary-background-color',
      '--ls-active-primary-color',
      '--ls-active-secondary-color',
      '--ls-border-color',
      '--ls-secondary-border-color',
      '--ls-tertiary-border-color',
      '--ls-primary-text-color',
      '--ls-secondary-text-color',
      '--ls-block-highlight-color'
    ]

    // @ts-ignore
    const vals = await logseq.UI.resolveThemeCssPropsVals(props)
    if (!vals) return
    const style = document.body.style
    Object.entries(vals).forEach(([k, v]) => {
      style.setProperty(k, v as string)
    })
  }
  const setThemeMode = (mode: string) => {
    document.documentElement.dataset.theme = mode
  }

  logseq.App.onThemeChanged(() => {
    setTimeout(loadThemeVars, 100)
  })

  logseq.App.onThemeModeChanged((t) => {
    setTimeout(loadThemeVars, 100)
    setThemeMode(t.mode)
  })

  logseq.on('ui:visible:changed', ({ visible }) => {
    if (visible) loadThemeVars().catch(console.error)
  })

  setTimeout(() => {
    logseq.App.getUserConfigs().then(t => {
      setThemeMode(t.preferredThemeMode)
    })
  }, 100)
}

logseq.ready(main).catch(console.error)