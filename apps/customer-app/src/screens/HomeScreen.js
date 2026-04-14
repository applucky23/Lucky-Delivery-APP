import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  StatusBar,
  Dimensions 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getCustomer } from '../services/authService';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Name passed from PersonalDetail on first login
    if (route?.params?.name) {
      setUserName(route.params.name);
      return;
    }
    // Returning user — load from saved customer data
    getCustomer().then(c => {
      if (c?.name) setUserName(c.name);
    });
  }, [route?.params?.name]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* TopAppBar */}
      <View style={styles.header}>
        <View style={styles.locationContainer}>
          <MaterialIcons name="location-on" size={20} color="#16A34A" />
          <Text style={styles.locationText}>Addis Ababa</Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="notifications-none" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>Hello, {userName || 'there'}</Text>
          <Text style={styles.greetingSubtitle}>What do you need today?</Text>
        </View>

        {/* Main Services Section (Hero Cards) */}
        <View style={styles.heroGrid}>
          <TouchableOpacity style={styles.mainHeroCard} onPress={() => navigation.navigate('RequestForm', { serviceType: 'buy' })}>
            <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAlwr-idE1_XiZymbBCbb7u-dnqce9pKRMuzyPvpN8Xiz0Zdmb9wqfvMiDZZOyc5uNqAwMDIEd7bcdYVewq8CeM03HJEEEmfeOUeXnj5DuPTTWIAu2YJe85Y41xhjDmwXipgPtXOpK-zK-KsfP1qcW1cwvXZpwcYupeCRqeJ04SPAfqTqn1aH-sctljAvLsOEYu_SrsSsIr5Gn9QjoP57uoU7y5TPziw11TIpB5N7qzCOKd5yNqkhTl63yXWAf7-WRHuwZk4XPc3ESC' }} style={styles.heroImage} />
            <View style={styles.overlay} />
            <Text style={styles.heroTitle}>Buy Something</Text>
          </TouchableOpacity>

          <View style={styles.secondaryHeroRow}>
            <TouchableOpacity style={styles.secondaryHeroCard} onPress={() => navigation.navigate('RequestForm', { serviceType: 'pickup' })}>
              <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALcUBisBaeaexRnB1YhHtyHy_ARkLp215rHdrhIi4Nm86DCMqrYY3q66sDmd0dT1y66CoHweT5p7uldbm50Alg-7OBFsiGFiyCO2tAJsgBvCkOYyX5LJqpHJKliL_IbsiXELgPLKM-m9e5fnxcQVHd1DnhOoCcC0ObZlW08_KaF6G8WtPWrFk8DRsI56t7iPWSsgklheb-5BdELZBzMxTuPVbPMvV3ZpTbAIh0SvOqM_2V6VeSjpkyJ_uWgMvYcHkQIZNY3D-zsGMp' }} style={styles.heroImage} />
              <View style={styles.overlay} />
              <Text style={styles.secondaryHeroTitle}>Pick & Drop</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryHeroCard} onPress={() => navigation.navigate('RequestForm', { serviceType: 'errand' })}>
              <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDliKFapPVlbnWtwLGPoZLZ_XoNfRhLY9yZl87EqdCC24gADC6IXu_0vzgte42_5QCBtpAaWvvfeAPM5Am8hwReQEdcAViyaoDedQiQYgy7gaooG9sH7pAUyPvyrRPrl6xOglgwmuo7FoawFbnq7rgnt_1pEPu98OMSzQOum50eKqoi5I0j9H5tpzFPp8zifNMYXbFrJVDiJX55z3_u8K1JgFhQgheRThCQwU13EgC3GGhcz_8TdWUjgolAVtQB599y9NOjjmVzXg8n' }} style={styles.heroImage} />
              <View style={styles.overlay} />
              <Text style={styles.secondaryHeroTitle}>Run Errand</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Detailed Section 1: Buy Something */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Buy Something</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {buyItems.map((item, index) => (
              <TouchableOpacity key={index} style={styles.categoryItem}>
                <View style={styles.categoryImageContainer}>
                  <Image source={{ uri: item.img }} style={styles.categoryImage} />
                </View>
                <Text style={styles.categoryLabel}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Detailed Section 2: Pick & Drop */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Pick & Drop</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {pickDropItems.map((item, index) => (
              <TouchableOpacity key={index} style={styles.wideCategoryItem}>
                <View style={styles.wideImageContainer}>
                  <Image source={{ uri: item.img }} style={styles.categoryImage} />
                </View>
                <View style={styles.labelPadding}>
                  <Text style={styles.categoryLabel}>{item.title}</Text>
                  <Text style={styles.categorySubLabel}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Detailed Section 3: Run Errand */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Run Errand</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {errandItems.map((item, index) => (
              <TouchableOpacity key={index} style={styles.wideCategoryItem}>
                <View style={styles.wideImageContainer}>
                  <Image source={{ uri: item.img }} style={styles.categoryImage} />
                </View>
                <View style={styles.labelPadding}>
                  <Text style={styles.categoryLabel}>{item.title}</Text>
                  <Text style={styles.categorySubLabel}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom || 15 }]}>
        <TouchableOpacity style={styles.navItem}>
          <MaterialIcons name="home" size={28} color="#16A34A" />
          <Text style={[styles.navText, { color: '#16A34A' }]}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('TaskList')}>
          <MaterialIcons name="assignment" size={26} color="#6B7280" />
          <Text style={styles.navText}>TASKS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
          <MaterialIcons name="person" size={28} color="#6B7280" />
          <Text style={styles.navText}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- DATA ARRAYS FROM YOUR HTML ---

const buyItems = [
  { title: "Buy Groceries", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB_akCF38ZlLhy8THxsFJrWDXN_54-fAJWiMRJs-eJlJN8BQZ3UuDe5WfKFv7QwFiQSHXNuvpq-R8Qr8DlW1vazUJktYoGewLOxO7WgM_wVR5x_GlNUvV7vHetbgupyhm4rbgpYtOTpmLcPsEOc1d093g3s80nba-1ZhoOuMMDLp7_qZW6HiFC3NP4vY0qu7ny1jEmB39D_XNAfg7KvDxN0uPOAeAEBPjJtKxjvRiOj_MO44AqvZ4Gex2AHGTVRT1Q2sw2GGlI5wYee" },
  { title: "Order Food", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBVRA-2xJ9FMs8314plOcPzhhoVmkDvuXkLzwnWsT9la--VwcvbaoQwDcZWflO9vbvDGTGcb1FPsC3GfBk5Tf6vEXWuZWDq8_N1eSree6a0_DPTDnb1ItAxOoqB8U95Xb9yUmPr20J2JNdyKnEolaPopcthDjjFmE-yUSb8BK8PJdnuLNhTIm-Ivxf01ssIV81OGwYNPbfLDK-6v2KLAXY6ADXBfJ6ucKgXwsK1Hekbeb0Ey4byyUBzKt7HDRnoaJQrZEfjdZ9sxaQi" },
  { title: "Buy Medicine", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBMQ7MBiiXtDd0C-wnhFRefL7goECaxIQQfs5t4KuQC7qwJ0qhku8tpRlNyVoO9plwgZZVXwGeYiO2VOLoPi1Fz5TWxsGz7oHNBeWBy80scD0PXS2ZMup7hEIcr9Xthso21SJEppb65kiMvVVQgBTy8nJyISHT_JbvQvI1s3NtiSN1RGd97OhR3nlWymZ2Q3hIu0PGWe92FQDiisRCVB9gvbAmuCeH597gXrbgNzwJlHEswBwYcAvmsog8bt7CgOmCEml_MpAqqDLrB" },
  { title: "Buy Water & Drinks", img: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80" },
  { title: "Buy Electronics", img: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&q=80" },
  { title: "Buy Household Items", img: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&q=80" },
  { title: "Custom Purchase", img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80" },
];

const pickDropItems = [
  { title: "Deliver Package", sub: "FAST DELIVERY", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCGNnq6fj2483FR-f0oCMmfG3QPHTptoPeOw5rWMeUr8bPI2mFwm56IkGqqmPIhRUzZMUASZFoXboRTmLSPndvVVYVxYiylWpooUrHwo5zNZweA8hVVIxhs7JCjVa4UY6v4eW7sI9AIbLfgFXF16QCJzve666B_HmDKwFzQs9BYOuvWMcth8x0caKNYVtsG5YWEFgcSuKyNqw4fWLkwPEA8f_GqYs0dME09M80ddCF4_LCUuD_Hu0IhZ9aiH2AbiSTBnJtLqyUtJkCI" },
  { title: "Pick Up Item", sub: "ANY LOCATION", img: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&q=80" },
  { title: "Send Documents", sub: "SECURE & PRIVATE", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAoP42LqgGP7qTwLC8ZhYL-tkT6-nw5lOwlO80Mvg5Ky7fSMn6l-OXmkYK1ewrOemZ-ZJI2UuCffBgKYDYZZ6zmVa6genOhXG-FhUAYSeHd1yUj_ymuYTVwxjUszzgMcYXlp3xjLT2Qwb67I-GFImpxLoKENFm7kuKGa_QbnBMHlRKXWXJCJ0RB_POnwfntBvHgTbv9GugdNy9FRzfky2z7-ASnjXuvV5djuHmG7wbAfOONU3LyidL6Gmbyp3ZthzEwfxeRq3FTH0LK" },
  { title: "Receive Delivery", sub: "CONTACTLESS", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBJgtWoYWmK-GzvLXoOIaf4PQNfO5PLQRSoej_p49CDKun7henfXj2oC9r0uFrdRqu3sRihsbbc8Cn1SmTU3Kythw31C_xXs9_KTZ6pUiLfNVUsnNdY0qIVwO0M9oBJDF4VRMgAo4oxUBI2GEksG2tdBc2m-GyIx4N9-cTKaL5VkZiut97rffFIvYPtMvk_fglrRDXjGQZ6XO-v1tVkBLcAfyEkkzl348wSgUqg2sUUBlG63tcGahsVfz49RUfr74rGw8pYFeeK4n09" },
  { title: "Business Delivery", sub: "B2B SOLUTIONS", img: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&q=80" },
  { title: "Move Small Items", sub: "LIGHT RELOCATION", img: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=400&q=80" },
  { title: "Custom Delivery", sub: "SPECIAL REQUESTS", img: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=400&q=80" },
];

const errandItems = [
  { title: "Pay Bills", sub: "HASSLE-FREE PAYMENTS", img: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80" },
  { title: "Submit Documents", sub: "GOVERNMENT OR PRIVATE", img: "https://images.unsplash.com/photo-1568219557405-376e23e4f7cf?w=400&q=80" },
  { title: "Pick Up Documents", sub: "SAFE RETRIEVAL", img: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=80" },
  { title: "Wait in Line", sub: "WE DO THE WAITING FOR YOU", img: "https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=400&q=80" },
  { title: "Laundry Service", sub: "WASH & FOLD CONCIERGE", img: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=80" },
  { title: "Refill Essentials", sub: "GAS, WATER, SUPPLIES", img: "https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=400&q=80" },
  { title: "Custom Errand", sub: "TELL US WHAT YOU NEED", img: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&q=80" },
];

// --- STYLES ---

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9ff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    height: 64,
    backgroundColor: 'rgba(249,249,255,0.7)',
  },
  locationContainer: { flexDirection: 'row', alignItems: 'center' },
  locationText: { marginLeft: 4, fontWeight: '700', fontSize: 14, color: '#141b2b' },
  iconButton: { padding: 8 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 10 },
  greetingSection: { marginBottom: 24 },
  greetingTitle: { fontSize: 30, fontWeight: '800', color: '#111827' },
  greetingSubtitle: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  heroGrid: { gap: 16 },
  mainHeroCard: {
    height: 192, borderRadius: 32, overflow: 'hidden',
    shadowColor: '#141b2b', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06, shadowRadius: 32, elevation: 4,
  },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  heroTitle: { position: 'absolute', bottom: 24, left: 24, color: 'white', fontSize: 24, fontWeight: '800' },
  secondaryHeroRow: { flexDirection: 'row', gap: 16 },
  secondaryHeroCard: {
    flex: 1, height: 224, borderRadius: 32, overflow: 'hidden',
    shadowColor: '#141b2b', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06, shadowRadius: 32, elevation: 4,
  },
  secondaryHeroTitle: { position: 'absolute', bottom: 20, left: 20, color: 'white', fontSize: 18, fontWeight: '700' },
  sectionContainer: { marginTop: 32 },
  sectionHeader: { fontSize: 20, fontWeight: '800', color: '#141b2b', marginBottom: 16 },
  horizontalScroll: { marginHorizontal: -24, paddingHorizontal: 24 },
  categoryItem: { width: 128, marginRight: 16 },
  wideCategoryItem: { width: 176, marginRight: 16 },
  categoryImageContainer: { height: 128, width: 128, borderRadius: 28, backgroundColor: '#f1f3ff', overflow: 'hidden' },
  wideImageContainer: { height: 112, width: '100%', borderRadius: 20, backgroundColor: '#f1f3ff', overflow: 'hidden' },
  categoryImage: { width: '100%', height: '100%' },
  labelPadding: { paddingHorizontal: 4 },
  categoryLabel: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#141b2b' },
  categorySubLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#f9f9ff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    height: 90,
    borderTopWidth: 1,
    borderTopColor: '#e8e8f0',
    shadowColor: '#141b2b',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  navItem: { alignItems: 'center', paddingTop: 16, marginBottom: 10 },
  navText: { fontSize: 11, fontWeight: '700', marginTop: 4, color: '#6B7280' }
});

export default HomeScreen;