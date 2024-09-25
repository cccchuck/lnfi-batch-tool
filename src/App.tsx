import {
  ActionIcon,
  Button,
  Divider,
  Flex,
  Indicator,
  PasswordInput,
  Textarea,
} from '@mantine/core'
import { BIP32Factory } from 'bip32'
import * as bip39 from 'bip39'
import * as bitcoin from 'bitcoinjs-lib'
import { finalizeEvent, getPublicKey, nip04, nip19, Relay } from 'nostr-tools'
import { useCallback, useEffect, useState } from 'react'
import * as ecc from 'tiny-secp256k1'

import './App.css'

import { toast } from 'sonner'
import { IconRefresh } from '@tabler/icons-react'

type SupportedToken = 'SATS' | 'TREAT' | 'TRICK' | 'NOSTR' | 'TNA'

type Wallet = {
  nsec: string
  npub: string
  privateKey: Uint8Array
}

type Task = {
  address: string
  amount: number
  token: SupportedToken
}

type Receipt = Task & {
  eventId?: string
  error?: string
}

const SUPPORTED_TOKENS: SupportedToken[] = [
  'SATS',
  'TREAT',
  'TRICK',
  'NOSTR',
  'TNA',
]
const DERIVE_PATH = `m/44'/1237'/index'/0/0`
const LNFI_RELAY = 'wss://relay.lnfi.network'
const LNFI_SEND_ADDR = nip19.decode(
  'npub1dy7n73dcrs0n24ec87u4tuagevkpjnzyl7aput69vmn8saemgnuq0a4n6y'
).data

const bip32 = BIP32Factory(ecc)

function App() {
  const [relay, setRelay] = useState<Relay | null>(null)
  const [mnemonic, setMnemonic] = useState('')
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [tasks, setTasks] = useState('')
  const [loading, setLoading] = useState(false)

  const transfer = useCallback(
    async (
      token: 'SATS' | 'TREAT' | 'TRICK' | 'NOSTR' | 'TNA',
      amount: number,
      receiver: string,
      privateKey: Uint8Array
    ) => {
      if (!relay) {
        toast.error('请先连接 relay')
        return
      }

      if (!relay.connected) {
        await relay.connect()
      }

      const msg = `transfer ${amount} ${token} to ${receiver}`
      const content = await nip04.encrypt(privateKey, LNFI_SEND_ADDR, msg)

      const tags = [
        ['p', LNFI_SEND_ADDR],
        ['r', 'json'],
      ]

      const event = finalizeEvent(
        {
          content,
          tags,
          kind: 4,
          created_at: Math.floor(Date.now() / 1000),
        },
        privateKey
      )

      await relay.publish(event)

      return event.id
    },
    [relay]
  )

  const handleConnectRelay = async () => {
    if (relay?.connected) {
      return
    }

    const _relay = new Relay(LNFI_RELAY)
    try {
      await _relay.connect()
      setRelay(_relay)
    } catch (error) {
      console.error('Connect relay error: ', error)
      toast.error('连接 relay 失败')
    }
  }

  useEffect(() => {
    handleConnectRelay()
  }, [])

  const handleLoadWallet = () => {
    if (!mnemonic) {
      return
    }

    if (!bip39.validateMnemonic(mnemonic)) {
      toast.error('无效的助记词')
      return
    }

    try {
      const seed = bip39.mnemonicToSeedSync(mnemonic)
      const root = bip32.fromSeed(
        Uint8Array.from(seed),
        bitcoin.networks.bitcoin
      )
      const child = root.derivePath(DERIVE_PATH.replace('index', '0'))
      const privateKey = child.privateKey!
      toast.success('钱包加载成功')
      setWallet({
        privateKey,
        nsec: nip19.nsecEncode(privateKey),
        npub: nip19.npubEncode(getPublicKey(privateKey)),
      })
    } catch (error) {
      console.error('Load wallet error: ', error)
      toast.error('加载钱包失败')
    }
  }

  const handleTransfer = async () => {
    if (!wallet?.nsec) {
      toast.error('请先加载钱包')
      return
    }

    setLoading(true)

    const receipts: Receipt[] = []
    let parsedTasks: Task[] = []

    try {
      parsedTasks = tasks.split('\n').map((line) => {
        const [address, token, amount] = line.split('-')
        return {
          address,
          amount: parseInt(amount),
          token: token.toUpperCase() as
            | 'SATS'
            | 'TREAT'
            | 'TRICK'
            | 'NOSTR'
            | 'TNA',
        }
      })
    } catch (error) {
      console.error('Parse tasks error: ', error)
      toast.error('转账地址格式错误')
    } finally {
      setLoading(false)
    }

    if (!parsedTasks.length) {
      return
    }

    for (const task of parsedTasks) {
      if (!SUPPORTED_TOKENS.includes(task.token)) {
        receipts.push({
          ...task,
          error: '不支持的币种',
        })
        continue
      }
      const eventId = await transfer(
        task.token,
        task.amount,
        task.address,
        wallet.privateKey
      )
      receipts.push({
        ...task,
        eventId,
      })
    }

    const blob = new Blob([JSON.stringify(receipts, null, 2)], {
      type: 'application/json',
    })

    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'receipts.json'
    a.click()
    a.remove()

    setLoading(false)
    toast.success('转账成功，交易收据已下载')
  }

  return (
    <main className="max-w-screen-lg mx-auto py-4">
      <header className="mb-4">
        <h2 className="text-2xl font-bold mb-2">Lnfi 批量转账工具</h2>
        <p className="text-neutral-700">
          代码仓库：
          <a
            className="text-blue-600"
            href="https://github.com/cccchuck/lnfi-batch-tool"
            target="_blank"
          >
            https://github.com/cccchuck/lnfi-batch-tool
          </a>
        </p>
      </header>

      <Divider variant="dashed" className="mb-4" />

      {!wallet?.npub ? (
        <Flex align="end" gap="md" className="mb-4">
          <PasswordInput
            flex={1}
            label="主钱包助记词"
            placeholder="xxx xxx xxx"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
          />
          <Button onClick={handleLoadWallet}>加载钱包</Button>
        </Flex>
      ) : (
        <div className="mb-4">
          <h3 className="font-bold mb-2">主钱包地址: {wallet.npub}</h3>
          <p className="text-sm text-neutral-700">
            分发前请确保主钱包有足够余额
          </p>
        </div>
      )}

      <Textarea
        autosize
        label="转账地址(一行一个，格式: 地址-币种-金额)"
        placeholder="npubxxxx-TREAT-100"
        minRows={10}
        value={tasks}
        onChange={(e) => setTasks(e.target.value)}
        className="mb-4"
      />
      <Flex justify="end">
        <Button
          loading={loading}
          disabled={!wallet?.npub || !tasks}
          onClick={handleTransfer}
        >
          批量转账
        </Button>
      </Flex>

      <Flex align="center" gap="md">
        <Indicator
          inline
          processing
          color={relay?.connected ? 'green' : 'red'}
          size={8}
        />
        <p className="text-neutral-700 font-semibold">Relay: {LNFI_RELAY}</p>
        {!relay?.connected && (
          <ActionIcon
            className="ml-[-12px]"
            variant="transparent"
            size={20}
            onClick={handleConnectRelay}
          >
            <IconRefresh stroke={2.5} style={{ width: '80%', height: '80%' }} />
          </ActionIcon>
        )}
      </Flex>
    </main>
  )
}

export default App
