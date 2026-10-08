const RECORDING_FILE_NAME = 'interview-recording.mp4'

type SaveFileHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>
}

function savePicker() {
  const picker = (window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string
      types?: Array<{ description?: string; accept: Record<string, string[]> }>
    }) => Promise<SaveFileHandle>
  }).showSaveFilePicker
  return typeof picker === 'function' ? picker.bind(window) : null
}

export async function chooseRecordingFile(): Promise<SaveFileHandle | 'cancelled' | null> {
  const picker = savePicker()
  if (!picker) return null
  try {
    return await picker({
      suggestedName: RECORDING_FILE_NAME,
      types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    return null
  }
}

export async function writeRecordingFile(url: string, chosen: SaveFileHandle | null) {
  if (!chosen) {
    const link = document.createElement('a')
    link.href = url
    link.rel = 'noopener'
    link.download = RECORDING_FILE_NAME
    document.body.append(link)
    link.click()
    link.remove()
    return
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error('The recording could not be saved to that folder.')
  const writable = await chosen.createWritable()
  await writable.write(await response.blob())
  await writable.close()
}
