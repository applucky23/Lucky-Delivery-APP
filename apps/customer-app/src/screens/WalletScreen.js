import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const WalletScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={s.balanceCard}>
          <View style={s.balanceTop}>
            <MaterialIcons name="account-balance-wallet" size={28} color="rgba(255,255,255,0.8)" />
            <Text style={s.walletLabel}>Wallet</Text>
          </View>
          <Text style={s.balanceLabel}>Available Balance</Text>
          <Text style={s.balanceAmount}>0 ETB</Text>
          <TouchableOpacity
            style={s.withdrawBtn}
            activeOpacity={0.85}
            onPress={() => Alert.alert('Withdraw', 'No balance available to withdraw.')}
          >
            <MaterialIcons name="arrow-upward" size={16} color="#16A34A" />
            <Text style={s.withdrawText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* Transactions */}
        <Text style={s.sectionTitle}>Transactions</Text>
        <View style={s.emptyCard}>
          <MaterialIcons name="receipt-long" size={40} color="#D1D5DB" />
          <Text style={s.emptyTitle}>No transactions yet</Text>
          <Text style={s.emptySubtitle}>Your transaction history will appear here</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 16, paddingTop: 24, gap: 20 },

  balanceCard: {
    backgroundColor: '#16A34A', borderRadius: 20, padding: 24, gap: 6,
    shadowColor: '#16A34A', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  walletLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '700' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 16,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  withdrawText: { color: '#16A34A', fontSize: 13, fontWeight: '700' },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 40,
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});

export default WalletScreen;
